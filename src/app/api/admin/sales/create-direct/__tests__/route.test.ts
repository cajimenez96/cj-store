import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { MongoMemoryReplSet, MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';
import { signAdminToken } from '@/lib/jwt';

/**
 * Handler-level tests for POST /api/admin/sales/create-direct, run on both
 * topologies: replica set (transactions) and standalone (compensation).
 *
 * `@/lib/db` reads MONGODB_URI at import time and caches the connection on
 * `globalThis.mongooseCache`; each topology connects mongoose itself and
 * points that cache at the live connection, so `connectToDatabase()` inside
 * the handler reuses it.
 */

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:1/unused';

type RouteModule = typeof import('../route');
let POST: RouteModule['POST'];
let Order: typeof import('@/models/Order').default;
let SalesRecord: typeof import('@/models/SalesRecord').default;
let Product: typeof import('@/models/Product').default;
let User: typeof import('@/models/User').default;
let Counter: typeof import('@/models/Counter').default;

const topologies = [
  {
    name: 'replica set',
    start: async () => {
      const rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
      return { uri: rs.getUri('create-direct-rs'), stop: () => rs.stop() };
    },
  },
  {
    name: 'standalone',
    start: async () => {
      const m = await MongoMemoryServer.create();
      return { uri: m.getUri('create-direct-sa'), stop: () => m.stop() };
    },
  },
];

async function makeUser(role: 'admin' | 'superadmin' | 'seller', name = 'Vendedor Uno') {
  const user = await User.create({
    username: `${role}${Math.random().toString(36).slice(2, 8)}`,
    passwordHash: 'x',
    name,
    role,
    active: true,
  });
  const token = await signAdminToken({ id: String(user._id), username: user.username, role, name });
  return { user, token };
}

async function makeProduct(stock: number, prices: { retailPrice: number; wholesalePrice?: number } = { retailPrice: 10000, wholesalePrice: 8000 }) {
  const variantId = new Types.ObjectId();
  const product = await Product.create({
    name: 'Zapato Test',
    images: [],
    active: true,
    variants: [
      {
        _id: variantId,
        sku: `SKU-${Math.random().toString(36).slice(2, 8)}`,
        name: 'Negro 40',
        options: [],
        stock,
        active: true,
        ...prices,
      },
    ],
    totalStock: stock,
  });
  return { product, variantId: String(variantId), productId: String(product._id) };
}

function post(body: unknown, token?: string) {
  return new NextRequest('http://localhost/api/admin/sales/create-direct', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { cookie: `admin_token=${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const guest = { name: 'Ana', lastName: 'Pérez', phone: '1122334455' };

function saleBody(productId: string, variantId: string, qty: number, extra: Record<string, unknown> = {}) {
  return {
    guest,
    items: [{ productId, variantId, qty, variantLabel: 'Negro 40', ...((extra.item as object) ?? {}) }],
    paymentMethod: 'efectivo',
    ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'item')),
  };
}

async function variantStock(productId: string, variantId: string) {
  const p = await Product.findById(productId).lean();
  return p?.variants?.find((v) => String(v._id) === variantId)?.stock;
}

for (const topo of topologies) {
  describe(`POST create-direct on ${topo.name}`, () => {
    let stop: () => Promise<unknown>;

    beforeAll(async () => {
      ({ POST } = await import('../route'));
      Order = (await import('@/models/Order')).default;
      SalesRecord = (await import('@/models/SalesRecord')).default;
      Product = (await import('@/models/Product')).default;
      User = (await import('@/models/User')).default;
      Counter = (await import('@/models/Counter')).default;

      const server = await topo.start();
      stop = server.stop;
      await mongoose.connect(server.uri);
      globalThis.mongooseCache!.conn = mongoose;
      globalThis.mongooseCache!.promise = Promise.resolve(mongoose);
      // Collections must exist before transactions write to them.
      await Promise.all([Order.init(), SalesRecord.init(), Product.init(), User.init(), Counter.init()]);
    }, 120000);

    afterAll(async () => {
      await mongoose.disconnect();
      globalThis.mongooseCache!.conn = null;
      globalThis.mongooseCache!.promise = null;
      await stop();
    });

    beforeEach(async () => {
      await Promise.all([
        Order.deleteMany({}),
        SalesRecord.deleteMany({}),
        Product.deleteMany({}),
        User.deleteMany({}),
        Counter.deleteMany({}),
      ]);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    // ---------------------------------------------------------------------
    // Existing behaviour (must hold before and after the refactor)
    // ---------------------------------------------------------------------
    describe('existing behaviour', () => {
      it('rejects missing guest data with 400 and the same message', async () => {
        const { token } = await makeUser('admin');
        const res = await POST(post({ items: [{ productId: 'x', qty: 1 }] }, token));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          ok: false,
          error: 'BAD_REQUEST',
          message: 'Los datos del cliente son obligatorios.',
        });
      });

      it('rejects empty items with 400 and the same message', async () => {
        const { token } = await makeUser('admin');
        const res = await POST(post({ guest, items: [] }, token));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
          ok: false,
          error: 'BAD_REQUEST',
          message: 'La venta debe incluir al menos un producto.',
        });
      });

      it('creates an autorizado admin_direct order, a SalesRecord and decrements stock; response shape unchanged', async () => {
        const { token } = await makeUser('admin');
        const { productId, variantId } = await makeProduct(10);
        const res = await POST(
          post(saleBody(productId, variantId, 2, { paymentMethod: 'transferencia', discount: 1000, discountNote: '  cliente frecuente ' }), token)
        );
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(Object.keys(json).sort()).toEqual(['message', 'ok', 'orderId', 'orderNumber', 'salesRecordId', 'total'].sort());
        expect(json.ok).toBe(true);
        expect(json.message).toBe('Venta directa registrada y stock actualizado.');
        expect(json.total).toBe(19000);

        const order = await Order.findById(json.orderId).lean();
        expect(order?.status).toBe('autorizado');
        expect(order?.origin).toBe('admin_direct');
        expect(order?.notes).toBe('cliente frecuente');
        expect(order?.orderNumber).toBe(json.orderNumber);
        expect(order?.subtotal).toBe(20000);
        expect(order?.discount).toBe(1000);
        expect(order?.total).toBe(19000);
        expect(order?.paymentMethod).toBe('transferencia');
        expect(order?.items[0].appliedPriceType).toBe('retail');
        expect(order?.items[0].unitPrice).toBe(10000);

        const rec = await SalesRecord.findById(json.salesRecordId).lean();
        expect(String(rec?.orderId)).toBe(json.orderId);
        expect(rec?.orderNumber).toBe(json.orderNumber);
        expect(rec?.recordedPaymentMethod).toBe('transferencia');
        expect(rec?.appliedDiscountNote).toBe('cliente frecuente');
        expect(rec?.finalTotal).toBe(19000);

        expect(await variantStock(productId, variantId)).toBe(8);
      });

      it('a custom unitPrice is stored as appliedPriceType custom', async () => {
        const { token } = await makeUser('admin');
        const { productId, variantId } = await makeProduct(10);
        const res = await POST(post(saleBody(productId, variantId, 1, { item: { unitPrice: 7500 } }), token));
        expect(res.status).toBe(201);
        const order = await Order.findById((await res.json()).orderId).lean();
        expect(order?.items[0].appliedPriceType).toBe('custom');
        expect(order?.items[0].unitPrice).toBe(7500);
      });

      it('applies wholesale pricing when the cart reaches 5 units', async () => {
        const { token } = await makeUser('admin');
        const { productId, variantId } = await makeProduct(10);
        const res = await POST(post(saleBody(productId, variantId, 5), token));
        expect(res.status).toBe(201);
        const json = await res.json();
        const order = await Order.findById(json.orderId).lean();
        expect(order?.items[0].appliedPriceType).toBe('wholesale');
        expect(order?.items[0].unitPrice).toBe(8000);
        expect(json.total).toBe(40000);
      });

      it('labels a line wholesale with the retail price when no wholesale price exists', async () => {
        const { token } = await makeUser('admin');
        const { productId, variantId } = await makeProduct(10, { retailPrice: 10000 });
        const res = await POST(post(saleBody(productId, variantId, 5), token));
        expect(res.status).toBe(201);
        const order = await Order.findById((await res.json()).orderId).lean();
        expect(order?.items[0].appliedPriceType).toBe('wholesale');
        expect(order?.items[0].unitPrice).toBe(10000);
      });

      it('rejects an unknown product with 400 PRODUCT_NOT_FOUND', async () => {
        const { token } = await makeUser('admin');
        const ghost = String(new Types.ObjectId());
        const res = await POST(post(saleBody(ghost, String(new Types.ObjectId()), 1), token));
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.ok).toBe(false);
        expect(json.error).toBe('PRODUCT_NOT_FOUND');
        expect(await Order.countDocuments()).toBe(0);
      });
    });

    // ---------------------------------------------------------------------
    // New behaviour: attribution, list price, history, auth, stock guard
    // ---------------------------------------------------------------------
    describe('attribution and audit', () => {
      it('returns 401 without a session and writes nothing', async () => {
        const { productId, variantId } = await makeProduct(3);
        const res = await POST(post(saleBody(productId, variantId, 1)));
        expect(res.status).toBe(401);
        expect((await res.json()).error).toBe('UNAUTHORIZED');
        expect(await Order.countDocuments()).toBe(0);
        expect(await variantStock(productId, variantId)).toBe(3);
      });

      it('seller sale: soldBy from the session, listPrice = retail while unitPrice is custom, created history', async () => {
        const { user, token } = await makeUser('seller', 'Vendedor Uno');
        const { productId, variantId } = await makeProduct(10);
        const res = await POST(post(saleBody(productId, variantId, 1, { item: { unitPrice: 9000 } }), token));
        expect(res.status).toBe(201);
        const json = await res.json();

        const order = await Order.findById(json.orderId).lean();
        expect(String(order?.soldBy?.userId)).toBe(String(user._id));
        expect(order?.soldBy?.username).toBe(user.username);
        expect(order?.soldBy?.name).toBe('Vendedor Uno');
        expect(order?.items[0].listPrice).toBe(10000);
        expect(order?.items[0].unitPrice).toBe(9000);
        expect(order?.items[0].appliedPriceType).toBe('custom');
        expect(order?.history).toHaveLength(1);
        expect(order?.history[0].action).toBe('created');
        expect(String(order?.history[0].byUserId)).toBe(String(user._id));
        expect(order?.history[0].byName).toBe('Vendedor Uno');

        const rec = await SalesRecord.findById(json.salesRecordId).lean();
        expect(String(rec?.soldBy?.userId)).toBe(String(user._id));
        expect(rec?.soldBy?.username).toBe(user.username);
      });

      it('listPrice is the wholesale price at 5+ units even with a custom unitPrice', async () => {
        const { token } = await makeUser('seller');
        const { productId, variantId } = await makeProduct(10);
        const res = await POST(post(saleBody(productId, variantId, 5, { item: { unitPrice: 9500 } }), token));
        expect(res.status).toBe(201);
        const order = await Order.findById((await res.json()).orderId).lean();
        expect(order?.items[0].listPrice).toBe(8000);
        expect(order?.items[0].unitPrice).toBe(9500);
      });

      it('admin sale also gets soldBy', async () => {
        const { user, token } = await makeUser('admin', 'Admin Dos');
        const { productId, variantId } = await makeProduct(10);
        const res = await POST(post(saleBody(productId, variantId, 1), token));
        expect(res.status).toBe(201);
        const order = await Order.findById((await res.json()).orderId).lean();
        expect(String(order?.soldBy?.userId)).toBe(String(user._id));
        expect(order?.soldBy?.name).toBe('Admin Dos');
        expect(order?.items[0].listPrice).toBe(10000);
      });

      it('ignores soldBy / userId sent in the body', async () => {
        const { user, token } = await makeUser('seller');
        const other = new Types.ObjectId();
        const { productId, variantId } = await makeProduct(10);
        const res = await POST(
          post(
            saleBody(productId, variantId, 1, {
              soldBy: { userId: String(other), username: 'intruso', name: 'Intruso' },
              userId: String(other),
            }),
            token
          )
        );
        expect(res.status).toBe(201);
        const json = await res.json();
        const order = await Order.findById(json.orderId).lean();
        expect(String(order?.soldBy?.userId)).toBe(String(user._id));
        expect(order?.soldBy?.username).toBe(user.username);
        const rec = await SalesRecord.findById(json.salesRecordId).lean();
        expect(String(rec?.soldBy?.userId)).toBe(String(user._id));
      });
    });

    describe('stock safety', () => {
      it('selling more than stock returns 409 naming the product and the available quantity; nothing changes', async () => {
        const { token } = await makeUser('seller');
        const { productId, variantId } = await makeProduct(2);
        const res = await POST(post(saleBody(productId, variantId, 3), token));
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.ok).toBe(false);
        expect(json.error).toBe('INSUFFICIENT_STOCK');
        expect(json.message).toContain('Zapato Test');
        expect(json.message).toContain('Negro 40');
        expect(json.message).toContain('Disponible: 2');
        expect(await variantStock(productId, variantId)).toBe(2);
        expect(await Order.countDocuments()).toBe(0);
        expect(await SalesRecord.countDocuments()).toBe(0);
      });

      it('two lines of the same variant cannot oversell together', async () => {
        const { token } = await makeUser('seller');
        const { productId, variantId } = await makeProduct(3);
        const body = {
          guest,
          paymentMethod: 'efectivo',
          items: [
            { productId, variantId, qty: 2, variantLabel: 'Negro 40' },
            { productId, variantId, qty: 2, variantLabel: 'Negro 40' },
          ],
        };
        const res = await POST(post(body, token));
        expect(res.status).toBe(409);
        expect(await variantStock(productId, variantId)).toBe(3);
        expect(await Order.countDocuments()).toBe(0);
      });

      it('a failure after the stock write leaves no order, sales record or stock change', async () => {
        const { token } = await makeUser('seller');
        const { productId, variantId } = await makeProduct(4);
        vi.spyOn(SalesRecord, 'create').mockRejectedValue(new Error('boom'));
        const res = await POST(post(saleBody(productId, variantId, 1), token));
        expect(res.status).toBe(500);
        expect((await res.json()).error).toBe('INTERNAL_SERVER_ERROR');
        expect(await variantStock(productId, variantId)).toBe(4);
        expect(await Order.countDocuments()).toBe(0);
        expect(await SalesRecord.countDocuments()).toBe(0);
        const p = await Product.findById(productId).lean();
        expect(p?.totalStock).toBe(4);
      });

      it('two parallel sales of the last unit: exactly one succeeds, the other gets 409; stock ends at 0', async () => {
        const a = await makeUser('seller', 'Vendedor A');
        const b = await makeUser('seller', 'Vendedor B');
        const { productId, variantId } = await makeProduct(1);
        const results = await Promise.all([
          POST(post(saleBody(productId, variantId, 1), a.token)),
          POST(post(saleBody(productId, variantId, 1), b.token)),
        ]);
        expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
        expect(await variantStock(productId, variantId)).toBe(0);
        expect(await Order.countDocuments()).toBe(1);
        expect(await SalesRecord.countDocuments()).toBe(1);
        const p = await Product.findById(productId).lean();
        expect(p?.totalStock).toBe(0);
      });

      it('order numbers are unique across sales', async () => {
        const { token } = await makeUser('admin');
        const { productId, variantId } = await makeProduct(10);
        const r1 = await (await POST(post(saleBody(productId, variantId, 1), token))).json();
        const r2 = await (await POST(post(saleBody(productId, variantId, 1), token))).json();
        expect(r1.orderNumber).not.toBe(r2.orderNumber);
        expect(r1.orderNumber).toMatch(/^PED-\d{4}-N\d+$/);
      });
    });
  });
}
