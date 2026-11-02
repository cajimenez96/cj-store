import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryReplSet, MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { type ClientSession, Types } from 'mongoose';
import Product from '@/models/Product';
import Counter, { getNextSequence } from '@/models/Counter';
import {
  applyStockDeltas,
  InsufficientStockError,
  nextOrderNumber,
  type StockDelta,
} from '@/lib/stock-ops';

/**
 * Every scenario runs on two topologies:
 * - replica set: the caller owns a transaction and passes its session;
 * - standalone: no session, so stock-ops must use compensating updates.
 *
 * `run` hides the difference: on the replica set it wraps the call in
 * `session.withTransaction` (which retries transient write conflicts, as a
 * real caller must), on standalone it calls without a session.
 */
type Runner = <T>(fn: (session: ClientSession | null) => Promise<T>) => Promise<T>;

interface Topology {
  name: string;
  start: () => Promise<{ uri: string; stop: () => Promise<unknown> }>;
  run: Runner;
}

const withTxn: Runner = async (fn) => {
  const session = await mongoose.startSession();
  try {
    let result: Awaited<ReturnType<typeof fn>> | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as Awaited<ReturnType<typeof fn>>;
  } finally {
    await session.endSession();
  }
};

const noSession: Runner = (fn) => fn(null);

const topologies: Topology[] = [
  {
    name: 'replica set (transaction)',
    start: async () => {
      const rs = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
      });
      return { uri: rs.getUri('stock-ops-rs'), stop: () => rs.stop() };
    },
    run: withTxn,
  },
  {
    name: 'standalone (compensation)',
    start: async () => {
      const m = await MongoMemoryServer.create();
      return { uri: m.getUri('stock-ops-sa'), stop: () => m.stop() };
    },
    run: noSession,
  },
];

function variant(over: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    sku: `SKU-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Negro 40',
    options: [],
    retailPrice: 10000,
    stock: 5,
    active: true,
    ...over,
  };
}

async function makeProduct(variants: ReturnType<typeof variant>[], over: Record<string, unknown> = {}) {
  const p = await Product.create({
    name: 'Zapato',
    images: [],
    variants,
    totalStock: variants.reduce((a, v) => a + v.stock, 0),
    ...over,
  });
  return p;
}

async function variantStock(productId: unknown, variantId: unknown): Promise<number> {
  const p = await Product.findById(productId).lean();
  const v = p?.variants?.find((x) => String(x._id) === String(variantId));
  return v?.stock ?? NaN;
}

for (const topo of topologies) {
  describe(`stock-ops on ${topo.name}`, () => {
    let stop: () => Promise<unknown>;
    const run = topo.run;

    beforeAll(async () => {
      const server = await topo.start();
      stop = server.stop;
      await mongoose.connect(server.uri);
      // Collections and unique indexes must exist before transactions and
      // concurrent upserts use them (production gets them from autoIndex).
      await Product.init();
      await Counter.init();
    }, 120000);

    afterAll(async () => {
      await mongoose.disconnect();
      await stop();
    });

    beforeEach(async () => {
      await Product.deleteMany({});
      await Counter.deleteMany({});
    });

    it('decrements a variant matched by variantId and recomputes totalStock', async () => {
      const v1 = variant({ stock: 5 });
      const v2 = variant({ name: 'Blanco 41', stock: 2 });
      const p = await makeProduct([v1, v2]);

      await run((s) => applyStockDeltas([{ productId: String(p._id), variantId: String(v1._id), qty: 2 }], s));

      const after = await Product.findById(p._id).lean();
      expect(after?.variants?.[0].stock).toBe(3);
      expect(after?.variants?.[1].stock).toBe(2);
      expect(after?.totalStock).toBe(5);
    });

    it('decrements a variant matched by variantName', async () => {
      const v1 = variant({ name: 'Negro 40', stock: 5 });
      const v2 = variant({ name: 'Blanco 41', stock: 4 });
      const p = await makeProduct([v1, v2]);

      await run((s) => applyStockDeltas([{ productId: String(p._id), variantName: 'Blanco 41', qty: 4 }], s));

      expect(await variantStock(p._id, v1._id)).toBe(5);
      expect(await variantStock(p._id, v2._id)).toBe(0);
      expect((await Product.findById(p._id).lean())?.totalStock).toBe(5);
    });

    it('totalStock ignores inactive variants, like calculateDerivedProductFields', async () => {
      const v1 = variant({ stock: 5 });
      const v2 = variant({ name: 'Inactiva', stock: 7, active: false });
      const p = await makeProduct([v1, v2], { totalStock: 999 });

      await run((s) => applyStockDeltas([{ productId: String(p._id), variantId: String(v1._id), qty: 1 }], s));

      expect((await Product.findById(p._id).lean())?.totalStock).toBe(4);
    });

    it('the guard checks the targeted variant, not a sibling with stock', async () => {
      const empty = variant({ name: 'Agotada', stock: 0 });
      const full = variant({ name: 'Llena', stock: 5 });
      const p = await makeProduct([empty, full]);

      const err = await run((s) =>
        applyStockDeltas([{ productId: String(p._id), variantId: String(empty._id), qty: 1 }], s)
      ).catch((e) => e);

      expect(err).toBeInstanceOf(InsufficientStockError);
      expect(await variantStock(p._id, empty._id)).toBe(0);
      expect(await variantStock(p._id, full._id)).toBe(5);
    });

    it('legacy product without variants uses product-level stock', async () => {
      const p = await makeProduct([], { stock: 4, totalStock: 4 });

      await run((s) => applyStockDeltas([{ productId: String(p._id), qty: 3 }], s));

      const after = await Product.findById(p._id).lean();
      expect(after?.stock).toBe(1);
      expect(after?.totalStock).toBe(1);

      const err = await run((s) => applyStockDeltas([{ productId: String(p._id), qty: 2 }], s)).catch((e) => e);
      expect(err).toBeInstanceOf(InsufficientStockError);
      expect((err as InsufficientStockError).available).toBe(1);
      expect((await Product.findById(p._id).lean())?.stock).toBe(1);
    });

    it('negative qty restocks without a guard', async () => {
      const v1 = variant({ stock: 0 });
      const p = await makeProduct([v1]);

      await run((s) => applyStockDeltas([{ productId: String(p._id), variantId: String(v1._id), qty: -3 }], s));

      expect(await variantStock(p._id, v1._id)).toBe(3);
      expect((await Product.findById(p._id).lean())?.totalStock).toBe(3);
    });

    it('beyond stock throws InsufficientStockError and changes no variant when the 2nd of 2 fails', async () => {
      const v1 = variant({ stock: 5 });
      const v2 = variant({ name: 'Blanco 41', stock: 1 });
      const p = await makeProduct([v1, v2]);
      const deltas: StockDelta[] = [
        { productId: String(p._id), variantId: String(v1._id), qty: 2 },
        { productId: String(p._id), variantId: String(v2._id), qty: 2 },
      ];

      const err = await run((s) => applyStockDeltas(deltas, s)).catch((e) => e);

      expect(err).toBeInstanceOf(InsufficientStockError);
      expect((err as InsufficientStockError).item).toEqual(deltas[1]);
      expect((err as InsufficientStockError).available).toBe(1);
      expect(await variantStock(p._id, v1._id)).toBe(5);
      expect(await variantStock(p._id, v2._id)).toBe(1);
      expect((await Product.findById(p._id).lean())?.totalStock).toBe(6);
    });

    it('a failure on the 2nd item of 3 reverts the 1st across products', async () => {
      const a = variant({ stock: 5 });
      const b = variant({ stock: 0 });
      const c = variant({ stock: 5 });
      const pa = await makeProduct([a]);
      const pb = await makeProduct([b]);
      const pc = await makeProduct([c]);

      const err = await run((s) =>
        applyStockDeltas(
          [
            { productId: String(pa._id), variantId: String(a._id), qty: 1 },
            { productId: String(pb._id), variantId: String(b._id), qty: 1 },
            { productId: String(pc._id), variantId: String(c._id), qty: 1 },
          ],
          s
        )
      ).catch((e) => e);

      expect(err).toBeInstanceOf(InsufficientStockError);
      expect((err as InsufficientStockError).available).toBe(0);
      expect(await variantStock(pa._id, a._id)).toBe(5);
      expect(await variantStock(pb._id, b._id)).toBe(0);
      expect(await variantStock(pc._id, c._id)).toBe(5);
      expect((await Product.findById(pa._id).lean())?.totalStock).toBe(5);
    });

    it('a restock followed by a failure is reverted too', async () => {
      const a = variant({ stock: 2 });
      const b = variant({ stock: 0 });
      const p = await makeProduct([a, b]);

      const err = await run((s) =>
        applyStockDeltas(
          [
            { productId: String(p._id), variantId: String(a._id), qty: -4 },
            { productId: String(p._id), variantId: String(b._id), qty: 1 },
          ],
          s
        )
      ).catch((e) => e);

      expect(err).toBeInstanceOf(InsufficientStockError);
      expect(await variantStock(p._id, a._id)).toBe(2);
    });

    it('unknown product throws a clear Error and changes nothing', async () => {
      const a = variant({ stock: 5 });
      const p = await makeProduct([a]);
      const missing = String(new Types.ObjectId());

      const err = await run((s) =>
        applyStockDeltas(
          [
            { productId: String(p._id), variantId: String(a._id), qty: 1 },
            { productId: missing, qty: 1 },
          ],
          s
        )
      ).catch((e) => e);

      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(InsufficientStockError);
      expect((err as Error).message).toContain(missing);
      expect(await variantStock(p._id, a._id)).toBe(5);
    });

    it('unknown variant throws a clear Error and changes nothing', async () => {
      const a = variant({ stock: 5 });
      const p = await makeProduct([a]);

      const err = await run((s) =>
        applyStockDeltas(
          [
            { productId: String(p._id), variantId: String(a._id), qty: 1 },
            { productId: String(p._id), variantName: 'No existe', qty: -1 },
          ],
          s
        )
      ).catch((e) => e);

      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(InsufficientStockError);
      expect((err as Error).message).toContain('No existe');
      expect(await variantStock(p._id, a._id)).toBe(5);
    });

    it('rejects a non-integer qty before touching anything', async () => {
      const a = variant({ stock: 5 });
      const p = await makeProduct([a]);

      await expect(
        run((s) => applyStockDeltas([{ productId: String(p._id), variantId: String(a._id), qty: 1.5 }], s))
      ).rejects.toThrow(/qty/);
      expect(await variantStock(p._id, a._id)).toBe(5);
    });

    it('10 parallel sales of 1 unit against stock 3: exactly 3 succeed, stock ends 0', async () => {
      const a = variant({ stock: 3 });
      const p = await makeProduct([a]);
      const delta: StockDelta = { productId: String(p._id), variantId: String(a._id), qty: 1 };

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => run((s) => applyStockDeltas([delta], s)))
      );

      const ok = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(ok).toHaveLength(3);
      expect(failed).toHaveLength(7);
      for (const f of failed) expect(f.reason).toBeInstanceOf(InsufficientStockError);
      expect(await variantStock(p._id, a._id)).toBe(0);
      expect((await Product.findById(p._id).lean())?.totalStock).toBe(0);
    });

    it('getNextSequence starts at 1001 on first use', async () => {
      expect(await run((s) => getNextSequence('fresh-counter', s ?? undefined))).toBe(1001);
      expect(await run((s) => getNextSequence('fresh-counter', s ?? undefined))).toBe(1002);
    });

    it('nextOrderNumber: 20 parallel calls give 20 unique increasing numbers', async () => {
      const year = new Date().getFullYear();
      const numbers = await Promise.all(Array.from({ length: 20 }, () => run((s) => nextOrderNumber(s))));

      expect(new Set(numbers).size).toBe(20);
      const re = new RegExp(`^PED-${year}-N(\\d+)$`);
      for (const n of numbers) expect(n).toMatch(re);
      const seqs = numbers.map((n) => Number(re.exec(n)![1])).sort((x, y) => x - y);
      expect(seqs).toEqual(Array.from({ length: 20 }, (_, i) => 1001 + i));
    });
  });
}
