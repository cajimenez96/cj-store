import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { MongoMemoryReplSet, MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';
import { signAdminToken } from '@/lib/jwt';
import type { OrderStatus } from '@/models/Order';

/**
 * Handler-level tests for the admin orders API (list, detail, edit, cancel,
 * status change and authorize), on both topologies: replica set
 * (transactions) and standalone (compensation). Handlers are called directly,
 * so every role/ownership rule must live in the handlers themselves.
 *
 * Connection setup mirrors the create-direct tests: mongoose is connected here
 * and `globalThis.mongooseCache` points at it, so `connectToDatabase()` reuses it.
 */

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:1/unused';

type ListModule = typeof import('../route');
type DetailModule = typeof import('../[id]/route');
type AuthorizeModule = typeof import('../[id]/authorize/route');
let list: ListModule;
let detail: DetailModule;
let authorize: AuthorizeModule;
let Order: typeof import('@/models/Order').default;
let SalesRecord: typeof import('@/models/SalesRecord').default;
let Product: typeof import('@/models/Product').default;
let User: typeof import('@/models/User').default;

const topologies = [
  {
    name: 'replica set',
    replSet: true,
    start: async () => {
      const rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
      return { uri: rs.getUri('orders-rs'), stop: () => rs.stop() };
    },
  },
  {
    name: 'standalone',
    replSet: false,
    start: async () => {
      const m = await MongoMemoryServer.create();
      return { uri: m.getUri('orders-sa'), stop: () => m.stop() };
    },
  },
];

type Role = 'admin' | 'superadmin' | 'seller';

async function makeUser(role: Role, name = `Usuario ${role}`) {
  const user = await User.create({
    username: `${role}${Math.random().toString(36).slice(2, 8)}`,
    passwordHash: 'x',
    name,
    role,
    active: true,
  });
  const token = await signAdminToken({ id: String(user._id), username: user.username, role, name });
  return { user, token, id: String(user._id) };
}

async function makeProduct(stock: number, prices = { retailPrice: 10000, wholesalePrice: 8000 }) {
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

type Prod = Awaited<ReturnType<typeof makeProduct>>;

interface OrderOpts {
  status?: OrderStatus;
  origin?: 'web' | 'admin_direct';
  soldBy?: { _id: Types.ObjectId; username: string; name: string } | null;
  qty?: number;
  unitPrice?: number;
  listPrice?: number;
  discount?: number;
}

let orderSeq = 0;
async function makeOrder(p: Prod, opts: OrderOpts = {}) {
  const qty = opts.qty ?? 2;
  const unitPrice = opts.unitPrice ?? 10000;
  const subtotal = qty * unitPrice;
  const discount = opts.discount ?? 0;
  orderSeq += 1;
  const order = await Order.create({
    orderNumber: `PED-TEST-${orderSeq}-${Math.random().toString(36).slice(2, 6)}`,
    origin: opts.origin ?? 'admin_direct',
    guest: { name: 'Ana', lastName: 'Pérez', phone: '1122334455' },
    items: [
      {
        productId: p.product._id,
        variantId: new Types.ObjectId(p.variantId),
        name: 'Zapato Test',
        variantLabel: 'Negro 40',
        variantName: 'Negro 40',
        qty,
        ...(opts.listPrice !== undefined ? { listPrice: opts.listPrice } : {}),
        appliedPriceType: 'retail',
        unitPrice,
        subtotal,
      },
    ],
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
    paymentMethod: 'efectivo',
    status: opts.status ?? 'autorizado',
    ...(opts.soldBy
      ? { soldBy: { userId: opts.soldBy._id, username: opts.soldBy.username, name: opts.soldBy.name } }
      : {}),
  });
  return order;
}

function req(method: string, url: string, token?: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { cookie: `admin_token=${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function variantStock(p: Prod) {
  const prod = await Product.findById(p.productId).lean();
  return prod?.variants?.find((v) => String(v._id) === p.variantId)?.stock;
}

function editItem(p: Prod, qty: number, unitPrice = 10000) {
  return {
    productId: p.productId,
    variantId: p.variantId,
    name: 'Zapato Test',
    variantLabel: 'Negro 40',
    variantName: 'Negro 40',
    qty,
    unitPrice,
    appliedPriceType: 'retail',
  };
}

for (const topo of topologies) {
  describe(`admin orders API on ${topo.name}`, () => {
    let stop: () => Promise<unknown>;

    beforeAll(async () => {
      list = await import('../route');
      detail = await import('../[id]/route');
      authorize = await import('../[id]/authorize/route');
      Order = (await import('@/models/Order')).default;
      SalesRecord = (await import('@/models/SalesRecord')).default;
      Product = (await import('@/models/Product')).default;
      User = (await import('@/models/User')).default;
      const Counter = (await import('@/models/Counter')).default;

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
      ]);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------
    // Admin behaviour that existed before this task (pinned on the
    // unchanged code first, must keep passing after the rewrite).
    // -------------------------------------------------------------------
    describe('existing admin behaviour', () => {
      it('GET list returns every order with the same shape, status filter and pagination', async () => {
        const { token } = await makeUser('admin');
        const p = await makeProduct(10);
        await makeOrder(p, { origin: 'web', status: 'pendiente' });
        await makeOrder(p, { status: 'autorizado' });
        await makeOrder(p, { status: 'autorizado' });

        const all = await list.GET(req('GET', '/api/admin/orders', token));
        expect(all.status).toBe(200);
        const allJson = await all.json();
        expect(allJson.ok).toBe(true);
        expect(allJson.data).toHaveLength(3);
        expect(allJson.pagination).toEqual({ page: 1, limit: 3, total: 3, totalPages: 1 });
        expect(allJson.data[0].items[0].productId).toBe(p.productId);

        const filtered = await list.GET(req('GET', '/api/admin/orders?status=autorizado&limit=1&page=2', token));
        const fJson = await filtered.json();
        expect(fJson.data).toHaveLength(1);
        expect(fJson.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
      });

      it('GET detail returns the order; unknown id is 404 NOT_FOUND', async () => {
        const { token } = await makeUser('admin');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { origin: 'web', status: 'pendiente' });

        const res = await detail.GET(req('GET', `/api/admin/orders/${o._id}`, token), ctx(String(o._id)));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(true);
        expect(json.data.orderNumber).toBe(o.orderNumber);
        expect(json.data.items[0].productId).toBe(p.productId);

        const missing = await detail.GET(
          req('GET', `/api/admin/orders/${new Types.ObjectId()}`, token),
          ctx(String(new Types.ObjectId()))
        );
        expect(missing.status).toBe(404);
        expect(await missing.json()).toEqual({ ok: false, error: 'NOT_FOUND', message: 'Solicitud no encontrada' });
      });

      it('PUT edits a pendiente order (items, discount, notes, payment, guest) without touching stock', async () => {
        const { token } = await makeUser('admin');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { origin: 'web', status: 'pendiente', qty: 2 });

        const res = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, token, {
            guest: { name: ' Luis ', lastName: 'Gómez', phone: '999' },
            items: [editItem(p, 3, 9000)],
            discount: 1000,
            notes: ' nota ',
            paymentMethod: 'tarjeta',
          }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(true);

        const saved = await Order.findById(o._id).lean();
        expect(saved!.items[0].qty).toBe(3);
        expect(saved!.items[0].unitPrice).toBe(9000);
        expect(saved!.items[0].subtotal).toBe(27000);
        expect(saved!.subtotal).toBe(27000);
        expect(saved!.discount).toBe(1000);
        expect(saved!.total).toBe(26000);
        expect(saved!.notes).toBe('nota');
        expect(saved!.paymentMethod).toBe('tarjeta');
        expect(saved!.guest.name).toBe('Luis');
        expect(saved!.status).toBe('pendiente');
        expect(await variantStock(p)).toBe(10);
      });

      it('PUT on a completada order is 409 INVALID_STATUS', async () => {
        const { token } = await makeUser('admin');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { status: 'completada' });
        const res = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, token, { items: [editItem(p, 1)] }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(409);
        expect((await res.json()).error).toBe('INVALID_STATUS');
      });

      it('PATCH cancels a pendiente order without touching stock; invalid action 400; already cancelled 409', async () => {
        const { token } = await makeUser('admin');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { origin: 'web', status: 'pendiente' });

        const bad = await detail.PATCH(req('PATCH', `/api/admin/orders/${o._id}`, token, { action: 'x' }), ctx(String(o._id)));
        expect(bad.status).toBe(400);
        expect((await bad.json()).error).toBe('BAD_REQUEST');

        const res = await detail.PATCH(
          req('PATCH', `/api/admin/orders/${o._id}`, token, { action: 'cancel', notes: ' motivo ' }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(true);
        expect(json.data.orderNumber).toBe(o.orderNumber);
        const saved = await Order.findById(o._id).lean();
        expect(saved!.status).toBe('cancelado');
        expect(saved!.notes).toBe('motivo');
        expect(await variantStock(p)).toBe(10);

        const again = await detail.PATCH(req('PATCH', `/api/admin/orders/${o._id}`, token, { action: 'cancel' }), ctx(String(o._id)));
        expect(again.status).toBe(409);
        expect((await again.json()).error).toBe('INVALID_STATUS');
      });

      it('list PUT: pendiente -> completada takes stock, completada -> cancelada returns it, bad status 400', async () => {
        const { token } = await makeUser('admin');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { origin: 'web', status: 'pendiente', qty: 3 });

        const bad = await list.PUT(req('PUT', '/api/admin/orders', token, { id: String(o._id), status: 'autorizado' }));
        expect(bad.status).toBe(400);

        const done = await list.PUT(req('PUT', '/api/admin/orders', token, { id: String(o._id), status: 'completada' }));
        expect(done.status).toBe(200);
        expect((await done.json()).ok).toBe(true);
        expect((await Order.findById(o._id).lean())!.status).toBe('completada');
        expect(await variantStock(p)).toBe(7);

        const cancel = await list.PUT(req('PUT', '/api/admin/orders', token, { id: String(o._id), status: 'cancelada' }));
        expect(cancel.status).toBe(200);
        expect((await Order.findById(o._id).lean())!.status).toBe('cancelada');
        expect(await variantStock(p)).toBe(10);
      });

      it('authorize: pendiente -> autorizado, takes stock, creates a SalesRecord', async () => {
        const { token } = await makeUser('admin');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { origin: 'web', status: 'pendiente', qty: 4 });

        const res = await authorize.POST(
          req('POST', `/api/admin/orders/${o._id}/authorize`, token, { recordedPaymentMethod: 'efectivo' }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(true);
        expect(json.orderNumber).toBe(o.orderNumber);
        expect(json.message).toBe('Venta autorizada exitosamente y stock actualizado.');
        expect((await Order.findById(o._id).lean())!.status).toBe('autorizado');
        expect(await variantStock(p)).toBe(6);
        const sr = await SalesRecord.findById(json.salesRecordId).lean();
        expect(sr!.finalTotal).toBe(o.total);
      });

      it('authorize: missing payment 400, insufficient stock 409 with the same message, non-pendiente 409', async () => {
        const { token } = await makeUser('admin');
        const p = await makeProduct(2);
        const o = await makeOrder(p, { origin: 'web', status: 'pendiente', qty: 3 });

        const noPay = await authorize.POST(req('POST', `/api/admin/orders/${o._id}/authorize`, token, {}), ctx(String(o._id)));
        expect(noPay.status).toBe(400);
        expect((await noPay.json()).message).toBe('El medio de pago registrado es obligatorio.');

        const short = await authorize.POST(
          req('POST', `/api/admin/orders/${o._id}/authorize`, token, { recordedPaymentMethod: 'efectivo' }),
          ctx(String(o._id))
        );
        expect(short.status).toBe(409);
        expect(await short.json()).toEqual({
          ok: false,
          error: 'INSUFFICIENT_STOCK',
          message: 'Stock insuficiente para "Zapato Test" (Negro 40). Disponible: 2, Requerido: 3.',
        });
        expect(await variantStock(p)).toBe(2);
        expect((await Order.findById(o._id).lean())!.status).toBe('pendiente');

        const done = await makeOrder(p, { status: 'autorizado' });
        const notPending = await authorize.POST(
          req('POST', `/api/admin/orders/${done._id}/authorize`, token, { recordedPaymentMethod: 'efectivo' }),
          ctx(String(done._id))
        );
        expect(notPending.status).toBe(409);
        expect((await notPending.json()).error).toBe('INVALID_STATUS');
      });
    });

    // -------------------------------------------------------------------
    // Ownership scoping, seller rules, atomic edit/cancel and history.
    // -------------------------------------------------------------------
    describe('authentication', () => {
      it('every handler returns 401 without a session', async () => {
        const id = String(new Types.ObjectId());
        const responses = await Promise.all([
          list.GET(req('GET', '/api/admin/orders')),
          list.PUT(req('PUT', '/api/admin/orders', undefined, { id, status: 'completada' })),
          detail.GET(req('GET', `/api/admin/orders/${id}`), ctx(id)),
          detail.PUT(req('PUT', `/api/admin/orders/${id}`, undefined, {}), ctx(id)),
          detail.PATCH(req('PATCH', `/api/admin/orders/${id}`, undefined, { action: 'cancel' }), ctx(id)),
          authorize.POST(req('POST', `/api/admin/orders/${id}/authorize`, undefined, { recordedPaymentMethod: 'efectivo' }), ctx(id)),
        ]);
        for (const r of responses) {
          expect(r.status).toBe(401);
          expect((await r.json()).ok).toBe(false);
        }
      });
    });

    describe('list scoping', () => {
      it('a seller only sees their own orders, even with ?userId=<other>', async () => {
        const s1 = await makeUser('seller', 'Vendedor Uno');
        const s2 = await makeUser('seller', 'Vendedor Dos');
        const p = await makeProduct(10);
        const mine = await makeOrder(p, { soldBy: s1.user });
        await makeOrder(p, { soldBy: s2.user });
        await makeOrder(p, { origin: 'web', status: 'pendiente' });

        for (const q of ['', `?userId=${s2.id}`, '?userId=web', '?userId[$ne]=x']) {
          const res = await list.GET(req('GET', `/api/admin/orders${q}`, s1.token));
          expect(res.status).toBe(200);
          const json = await res.json();
          expect(json.data.map((o: { _id: string }) => o._id)).toEqual([String(mine._id)]);
          expect(json.pagination.total).toBe(1);
        }
      });

      it('admin filters by seller, by web, and ignores junk userId values', async () => {
        const admin = await makeUser('admin');
        const s1 = await makeUser('seller');
        const p = await makeProduct(10);
        const bySeller = await makeOrder(p, { soldBy: s1.user });
        const web = await makeOrder(p, { origin: 'web', status: 'pendiente' });
        await makeOrder(p, { soldBy: admin.user });

        const ids = async (q: string) =>
          (await (await list.GET(req('GET', `/api/admin/orders${q}`, admin.token))).json()).data.map(
            (o: { _id: string }) => o._id
          );

        expect(await ids(`?userId=${s1.id}`)).toEqual([String(bySeller._id)]);
        expect(await ids('?userId=web')).toEqual([String(web._id)]);
        expect(await ids('?userId=junk')).toHaveLength(3);
        expect(await ids('?userId[$ne]=x')).toHaveLength(3);
        expect(await ids(`?userId=${encodeURIComponent('{"$ne":null}')}`)).toHaveLength(3);
      });

      it('a seller cannot use the list status-change PUT (403, nothing changes)', async () => {
        const s1 = await makeUser('seller');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { soldBy: s1.user });
        const res = await list.PUT(req('PUT', '/api/admin/orders', s1.token, { id: String(o._id), status: 'cancelada' }));
        expect(res.status).toBe(403);
        expect((await res.json()).ok).toBe(false);
        expect((await Order.findById(o._id).lean())!.status).toBe('autorizado');
        expect(await variantStock(p)).toBe(10);
      });
    });

    describe('detail scoping', () => {
      it('a seller gets 404 identical to a missing order for other sellers, web and admin orders', async () => {
        const s1 = await makeUser('seller');
        const s2 = await makeUser('seller');
        const admin = await makeUser('admin');
        const p = await makeProduct(10);
        const others = [
          await makeOrder(p, { soldBy: s2.user }),
          await makeOrder(p, { origin: 'web', status: 'pendiente' }),
          await makeOrder(p, { soldBy: admin.user }),
          await makeOrder(p),
        ];
        const missingId = String(new Types.ObjectId());
        const missing = await detail.GET(req('GET', `/api/admin/orders/${missingId}`, s1.token), ctx(missingId));
        expect(missing.status).toBe(404);
        const missingBody = await missing.json();

        for (const o of others) {
          const res = await detail.GET(req('GET', `/api/admin/orders/${o._id}`, s1.token), ctx(String(o._id)));
          expect(res.status).toBe(404);
          expect(await res.json()).toEqual(missingBody);
        }

        const mine = await makeOrder(p, { soldBy: s1.user });
        const ok = await detail.GET(req('GET', `/api/admin/orders/${mine._id}`, s1.token), ctx(String(mine._id)));
        expect(ok.status).toBe(200);
        expect((await ok.json()).data.orderNumber).toBe(mine.orderNumber);
      });

      it('malformed ids are 404 without leaking driver text', async () => {
        const admin = await makeUser('admin');
        for (const bad of ['not-an-id', '123', '{"$ne":null}']) {
          const res = await detail.GET(req('GET', '/api/admin/orders/x', admin.token), ctx(bad));
          expect(res.status).toBe(404);
          expect(await res.json()).toEqual({ ok: false, error: 'NOT_FOUND', message: 'Solicitud no encontrada' });
          const put = await detail.PUT(req('PUT', '/api/admin/orders/x', admin.token, { notes: 'x' }), ctx(bad));
          expect(put.status).toBe(404);
          const patch = await detail.PATCH(req('PATCH', '/api/admin/orders/x', admin.token, { action: 'cancel' }), ctx(bad));
          expect(patch.status).toBe(404);
        }
      });
    });

    describe('seller edits', () => {
      it('qty 2 -> 1 restocks exactly 1 unit and appends quantity_changed', async () => {
        const s1 = await makeUser('seller', 'Vendedor Uno');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { soldBy: s1.user, qty: 2, listPrice: 10000 });

        const res = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, s1.token, { items: [editItem(p, 1)] }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(200);
        expect(await variantStock(p)).toBe(11);
        const saved = await Order.findById(o._id).lean();
        expect(saved!.items[0].qty).toBe(1);
        expect(saved!.subtotal).toBe(10000);
        expect(saved!.total).toBe(10000);
        expect(saved!.status).toBe('autorizado');
        const h = saved!.history.find((e) => e.action === 'quantity_changed');
        expect(h).toBeDefined();
        expect(h!.byName).toBe('Vendedor Uno');
        expect(String(h!.byUserId)).toBe(s1.id);
        expect((await Product.findById(p.productId).lean())!.totalStock).toBe(11);
      });

      it('qty increase takes stock and recomputes listPrice (wholesale at the threshold)', async () => {
        const s1 = await makeUser('seller');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { soldBy: s1.user, qty: 2, listPrice: 10000 });
        const res = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, s1.token, { items: [editItem(p, 5, 9500)] }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(200);
        expect(await variantStock(p)).toBe(7);
        const saved = await Order.findById(o._id).lean();
        expect(saved!.items[0].listPrice).toBe(8000);
        expect(saved!.items[0].unitPrice).toBe(9500);
        expect(saved!.subtotal).toBe(47500);
      });

      it('price change appends price_changed, updates unitPrice and keeps listPrice', async () => {
        const s1 = await makeUser('seller');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { soldBy: s1.user, qty: 2, listPrice: 10000 });
        const res = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, s1.token, {
            items: [editItem(p, 2, 12000)],
            discount: 500,
            paymentMethod: 'tarjeta',
          }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(200);
        const saved = await Order.findById(o._id).lean();
        expect(saved!.items[0].unitPrice).toBe(12000);
        expect(saved!.items[0].listPrice).toBe(10000);
        expect(saved!.subtotal).toBe(24000);
        expect(saved!.total).toBe(23500);
        const actions = saved!.history.map((e) => e.action);
        expect(actions).toEqual(expect.arrayContaining(['price_changed', 'discount_changed', 'payment_changed']));
        expect(actions).not.toContain('quantity_changed');
        expect(await variantStock(p)).toBe(10);
      });

      it('removing an item restocks it and adding one takes stock', async () => {
        const s1 = await makeUser('seller');
        const p = await makeProduct(10);
        const q = await makeProduct(5);
        const o = await makeOrder(p, { soldBy: s1.user, qty: 2 });
        const res = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, s1.token, { items: [editItem(q, 3)] }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(200);
        expect(await variantStock(p)).toBe(12);
        expect(await variantStock(q)).toBe(2);
        const actions = (await Order.findById(o._id).lean())!.history.map((e) => e.action);
        expect(actions).toEqual(expect.arrayContaining(['item_added', 'item_removed']));
      });

      it('an edit that exceeds stock is 409 and changes neither the order nor the stock', async () => {
        const s1 = await makeUser('seller');
        const p = await makeProduct(1);
        const o = await makeOrder(p, { soldBy: s1.user, qty: 2 });
        const before = await Order.findById(o._id).lean();
        const res = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, s1.token, { items: [editItem(p, 5)] }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error).toBe('INSUFFICIENT_STOCK');
        expect(await variantStock(p)).toBe(1);
        const after = await Order.findById(o._id).lean();
        expect(after!.items[0].qty).toBe(2);
        expect(after!.history).toHaveLength(before!.history.length);
        expect(after!.updatedAt).toEqual(before!.updatedAt);
      });

      it('rejects malformed payloads with 400 before touching anything', async () => {
        const s1 = await makeUser('seller');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { soldBy: s1.user, qty: 2 });
        const bad = [
          { items: [{ ...editItem(p, 1), productId: { $ne: null } }] },
          { items: [{ ...editItem(p, 1), variantId: 'zzz' }] },
          { items: [{ ...editItem(p, 1.5) }] },
          { items: [{ ...editItem(p, 0) }] },
          { items: [{ ...editItem(p, 1), unitPrice: -1 }] },
          { items: [{ ...editItem(p, 1), unitPrice: 'abc' }] },
          { items: [{ ...editItem(p, 1), name: { $gt: '' } }] },
          { discount: -5 },
          { discount: 'NaN' },
          { notes: { $set: 1 } },
          { guest: { name: 5 } },
          { paymentMethod: 'bitcoin' },
        ];
        for (const body of bad) {
          const res = await detail.PUT(req('PUT', `/api/admin/orders/${o._id}`, s1.token, body), ctx(String(o._id)));
          expect(res.status, JSON.stringify(body)).toBe(400);
          expect((await res.json()).ok).toBe(false);
        }
        expect(await variantStock(p)).toBe(10);
        expect((await Order.findById(o._id).lean())!.items[0].qty).toBe(2);
      });

      it('a seller cannot set completada (PUT or PATCH) -> 403', async () => {
        const s1 = await makeUser('seller');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { soldBy: s1.user });
        const patch = await detail.PATCH(
          req('PATCH', `/api/admin/orders/${o._id}`, s1.token, { status: 'completada' }),
          ctx(String(o._id))
        );
        expect(patch.status).toBe(403);
        const put = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, s1.token, { status: 'completada', items: [editItem(p, 2)] }),
          ctx(String(o._id))
        );
        expect(put.status).toBe(403);
        expect((await Order.findById(o._id).lean())!.status).toBe('autorizado');
      });

      it('a seller cannot edit or cancel a completada order (403, no stock change)', async () => {
        const s1 = await makeUser('seller');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { soldBy: s1.user, status: 'completada' });
        const put = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, s1.token, { items: [editItem(p, 1)] }),
          ctx(String(o._id))
        );
        expect(put.status).toBe(403);
        const patch = await detail.PATCH(
          req('PATCH', `/api/admin/orders/${o._id}`, s1.token, { action: 'cancel' }),
          ctx(String(o._id))
        );
        expect(patch.status).toBe(403);
        expect(await variantStock(p)).toBe(10);
        expect((await Order.findById(o._id).lean())!.status).toBe('completada');
      });

      it("a seller editing or cancelling another seller's order gets 404", async () => {
        const s1 = await makeUser('seller');
        const s2 = await makeUser('seller');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { soldBy: s2.user, qty: 2 });
        const put = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, s1.token, { items: [editItem(p, 1)] }),
          ctx(String(o._id))
        );
        expect(put.status).toBe(404);
        const patch = await detail.PATCH(
          req('PATCH', `/api/admin/orders/${o._id}`, s1.token, { action: 'cancel' }),
          ctx(String(o._id))
        );
        expect(patch.status).toBe(404);
        expect(await variantStock(p)).toBe(10);
        expect((await Order.findById(o._id).lean())!.items[0].qty).toBe(2);
      });

      it('an order save failing after stock moved leaves the stock reverted', async () => {
        const s1 = await makeUser('seller');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { soldBy: s1.user, qty: 2 });
        vi.spyOn(Order, 'findOneAndUpdate').mockRejectedValueOnce(new Error('internal boom detail'));
        const res = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, s1.token, { items: [editItem(p, 5)] }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.ok).toBe(false);
        expect(JSON.stringify(json)).not.toContain('boom');
        expect(await variantStock(p)).toBe(10);
        expect((await Order.findById(o._id).lean())!.items[0].qty).toBe(2);
      });
    });

    describe('cancel', () => {
      it('seller cancel restocks, appends cancelled with the reason; a second cancel is 409 with no extra restock', async () => {
        const s1 = await makeUser('seller');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { soldBy: s1.user, qty: 3 });

        const res = await detail.PATCH(
          req('PATCH', `/api/admin/orders/${o._id}`, s1.token, { action: 'cancel', cancelReason: 'Cliente desistió' }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(200);
        expect(await variantStock(p)).toBe(13);
        const saved = await Order.findById(o._id).lean();
        expect(saved!.status).toBe('cancelado');
        expect(saved!.cancelReason).toBe('Cliente desistió');
        const h = saved!.history.find((e) => e.action === 'cancelled');
        expect(h!.summary).toContain('Cliente desistió');

        const again = await detail.PATCH(
          req('PATCH', `/api/admin/orders/${o._id}`, s1.token, { action: 'cancel' }),
          ctx(String(o._id))
        );
        expect(again.status).toBe(409);
        expect(await variantStock(p)).toBe(13);

        const edit = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, s1.token, { items: [editItem(p, 1)] }),
          ctx(String(o._id))
        );
        expect(edit.status).toBe(409);
        expect(await variantStock(p)).toBe(13);
      });

      it('admin cancel of an autorizado order restocks once', async () => {
        const admin = await makeUser('admin');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { qty: 2 });
        const res = await detail.PATCH(
          req('PATCH', `/api/admin/orders/${o._id}`, admin.token, { action: 'cancel' }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(200);
        expect(await variantStock(p)).toBe(12);
      });

      it('a cancelled order cannot be reopened or re-cancelled through the list PUT', async () => {
        const admin = await makeUser('admin');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { qty: 2, status: 'cancelado' });
        for (const status of ['pendiente', 'completada', 'cancelada']) {
          const res = await list.PUT(req('PUT', '/api/admin/orders', admin.token, { id: String(o._id), status }));
          expect(res.status).toBe(409);
        }
        expect(await variantStock(p)).toBe(10);
      });

      it('list PUT autorizado -> cancelada returns the stock taken at authorization', async () => {
        const admin = await makeUser('admin');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { qty: 2 });
        const res = await list.PUT(req('PUT', '/api/admin/orders', admin.token, { id: String(o._id), status: 'cancelada' }));
        expect(res.status).toBe(200);
        expect(await variantStock(p)).toBe(12);
        const saved = await Order.findById(o._id).lean();
        expect(saved!.history.map((e) => e.action)).toContain('cancelled');
      });

      if (topo.replSet) {
        it('two parallel cancels: exactly one succeeds and the stock is restocked once', async () => {
          const s1 = await makeUser('seller');
          const p = await makeProduct(10);
          const o = await makeOrder(p, { soldBy: s1.user, qty: 2 });
          const results = await Promise.all(
            [0, 1].map(() =>
              detail.PATCH(
                req('PATCH', `/api/admin/orders/${o._id}`, s1.token, { action: 'cancel' }),
                ctx(String(o._id))
              )
            )
          );
          const statuses = results.map((r) => r.status).sort();
          expect(statuses).toEqual([200, 409]);
          expect(await variantStock(p)).toBe(12);
          const saved = await Order.findById(o._id).lean();
          expect(saved!.history.filter((e) => e.action === 'cancelled')).toHaveLength(1);
        });
      }
    });

    // -------------------------------------------------------------------
    // Fix round 1: stock state machine, seller status rule, search, paging.
    // -------------------------------------------------------------------
    describe('stock state machine', () => {
      const QTY = 3;
      const TOTAL = 10; // stock + units held by the order, conserved by every transition
      const HOLDING = new Set(['autorizado', 'completada']);
      const held = (status: string) => (HOLDING.has(status) ? QTY : 0);
      const FROM: OrderStatus[] = ['pendiente', 'autorizado', 'completada', 'cancelado'];
      type Via = { to: string; run: (id: string, token: string) => Promise<Response> };
      const VIAS: Via[] = [
        ...['pendiente', 'completada', 'cancelada'].map((to) => ({
          to,
          run: (id: string, token: string) => list.PUT(req('PUT', '/api/admin/orders', token, { id, status: to })),
        })),
        {
          to: 'cancelado',
          run: (id, token) => detail.PATCH(req('PATCH', `/api/admin/orders/${id}`, token, { action: 'cancel' }), ctx(id)),
        },
        {
          to: 'autorizado',
          run: (id, token) =>
            authorize.POST(
              req('POST', `/api/admin/orders/${id}/authorize`, token, { recordedPaymentMethod: 'efectivo' }),
              ctx(id)
            ),
        },
      ];

      for (const from of FROM) {
        for (const via of VIAS) {
          it(`${from} -> ${via.to}`, async () => {
            const admin = await makeUser('admin');
            const p = await makeProduct(TOTAL - held(from));
            const o = await makeOrder(p, { status: from, qty: QTY });
            const res = await via.run(String(o._id), admin.token);

            const cancelledFrom = from === 'cancelado';
            const authorizeNotPending = via.to === 'autorizado' && from !== 'pendiente';
            if (cancelledFrom || authorizeNotPending) {
              expect(res.status).toBe(409);
              expect((await Order.findById(o._id).lean())!.status).toBe(from);
              expect(await variantStock(p)).toBe(TOTAL - held(from));
              return;
            }
            expect(res.status).toBe(200);
            const saved = await Order.findById(o._id).lean();
            expect(saved!.status).toBe(via.to);
            const stock = (await variantStock(p))!;
            expect(stock).toBe(TOTAL - held(via.to));
            expect(stock + held(saved!.status)).toBe(TOTAL);
            if (from === via.to) expect(saved!.history).toHaveLength(0);
          });
        }
      }

      it('a round trip autorizado -> pendiente -> completada -> pendiente -> authorize -> cancel conserves stock', async () => {
        const admin = await makeUser('admin');
        const p = await makeProduct(TOTAL - QTY);
        const o = await makeOrder(p, { status: 'autorizado', qty: QTY });
        const id = String(o._id);
        const put = (status: string) => list.PUT(req('PUT', '/api/admin/orders', admin.token, { id, status }));
        expect((await put('pendiente')).status).toBe(200);
        expect(await variantStock(p)).toBe(TOTAL);
        expect((await put('completada')).status).toBe(200);
        expect(await variantStock(p)).toBe(TOTAL - QTY);
        expect((await put('pendiente')).status).toBe(200);
        expect(await variantStock(p)).toBe(TOTAL);
        const auth = await authorize.POST(
          req('POST', `/api/admin/orders/${id}/authorize`, admin.token, { recordedPaymentMethod: 'efectivo' }),
          ctx(id)
        );
        expect(auth.status).toBe(200);
        expect(await variantStock(p)).toBe(TOTAL - QTY);
        const cancel = await detail.PATCH(req('PATCH', `/api/admin/orders/${id}`, admin.token, { action: 'cancel' }), ctx(id));
        expect(cancel.status).toBe(200);
        expect(await variantStock(p)).toBe(TOTAL);
      });

      it('admin cancel of a completada order restocks once', async () => {
        const admin = await makeUser('admin');
        const p = await makeProduct(TOTAL - QTY);
        const o = await makeOrder(p, { status: 'completada', qty: QTY });
        const id = String(o._id);
        const first = await detail.PATCH(req('PATCH', `/api/admin/orders/${id}`, admin.token, { action: 'cancel' }), ctx(id));
        expect(first.status).toBe(200);
        const second = await detail.PATCH(req('PATCH', `/api/admin/orders/${id}`, admin.token, { action: 'cancel' }), ctx(id));
        expect(second.status).toBe(409);
        expect(await variantStock(p)).toBe(TOTAL);
      });

      it('an admin edit of a pendiente order changes it but moves no stock', async () => {
        const admin = await makeUser('admin');
        const p = await makeProduct(TOTAL);
        const o = await makeOrder(p, { status: 'pendiente', qty: QTY, origin: 'web' });
        const res = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, admin.token, { items: [editItem(p, 7)] }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(200);
        expect((await Order.findById(o._id).lean())!.items[0].qty).toBe(7);
        expect(await variantStock(p)).toBe(TOTAL);
      });

      if (!topo.replSet) {
        it('10 parallel cancels: one 200, the rest 409, stock restored once', async () => {
          const s1 = await makeUser('seller');
          const p = await makeProduct(TOTAL - QTY);
          const o = await makeOrder(p, { soldBy: s1.user, qty: QTY });
          const id = String(o._id);
          const results = await Promise.all(
            Array.from({ length: 10 }, () =>
              detail.PATCH(req('PATCH', `/api/admin/orders/${id}`, s1.token, { action: 'cancel' }), ctx(id))
            )
          );
          const statuses = results.map((r) => r.status);
          expect(statuses.filter((s) => s === 200)).toHaveLength(1);
          expect(statuses.filter((s) => s === 409)).toHaveLength(9);
          expect(await variantStock(p)).toBe(TOTAL);
          const saved = await Order.findById(id).lean();
          expect(saved!.history.filter((e) => e.action === 'cancelled')).toHaveLength(1);
        });
      }
    });

    describe('seller status rule', () => {
      for (const status of ['pendiente', 'confirmada'] as OrderStatus[]) {
        it(`a seller cannot edit or cancel their own ${status} order (403, nothing persisted)`, async () => {
          const s1 = await makeUser('seller');
          const p = await makeProduct(10);
          const o = await makeOrder(p, { soldBy: s1.user, status, qty: 2 });
          const before = await Order.findById(o._id).lean();
          const put = await detail.PUT(
            req('PUT', `/api/admin/orders/${o._id}`, s1.token, { items: [editItem(p, 1)] }),
            ctx(String(o._id))
          );
          expect(put.status).toBe(403);
          const patch = await detail.PATCH(
            req('PATCH', `/api/admin/orders/${o._id}`, s1.token, { action: 'cancel' }),
            ctx(String(o._id))
          );
          expect(patch.status).toBe(403);
          expect(await Order.findById(o._id).lean()).toEqual(before);
          expect(await variantStock(p)).toBe(10);
        });
      }

      it("a seller's own soldBy on a web order is 404 for edit and cancel", async () => {
        const s1 = await makeUser('seller');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { soldBy: s1.user, origin: 'web', qty: 2 });
        const before = await Order.findById(o._id).lean();
        const put = await detail.PUT(
          req('PUT', `/api/admin/orders/${o._id}`, s1.token, { items: [editItem(p, 1)] }),
          ctx(String(o._id))
        );
        expect(put.status).toBe(404);
        const patch = await detail.PATCH(
          req('PATCH', `/api/admin/orders/${o._id}`, s1.token, { action: 'cancel' }),
          ctx(String(o._id))
        );
        expect(patch.status).toBe(404);
        expect(await Order.findById(o._id).lean()).toEqual(before);
        expect(await variantStock(p)).toBe(10);
      });
    });

    describe('list search and paging', () => {
      it('treats regex metacharacters literally and still matches normal text', async () => {
        const admin = await makeUser('admin');
        const p = await makeProduct(10);
        const o = await makeOrder(p);
        await Order.updateOne({ _id: o._id }, { $set: { 'guest.name': 'Ana (a+)+$ [x] .* fin' } });
        await makeOrder(p);

        const count = async (q: string) => {
          const res = await list.GET(req('GET', `/api/admin/orders?search=${encodeURIComponent(q)}`, admin.token));
          expect(res.status).toBe(200);
          return (await res.json()).data.length;
        };
        expect(await count('(')).toBe(1);
        expect(await count('[')).toBe(1);
        expect(await count('.*')).toBe(1);
        expect(await count('(a+)+$')).toBe(1);
        expect(await count('a.a')).toBe(0);
        expect(await count('pérez')).toBe(2);
        expect(await count(o.orderNumber.toLowerCase())).toBe(1);
      });

      it('invalid page/limit fall back to the defaults', async () => {
        const admin = await makeUser('admin');
        const p = await makeProduct(10);
        await makeOrder(p);
        await makeOrder(p);
        for (const q of ['page=abc', 'page=-2', 'page=0', 'page=abc&limit=xyz', 'limit=-1', 'limit=0']) {
          const res = await list.GET(req('GET', `/api/admin/orders?${q}`, admin.token));
          const json = await res.json();
          expect(json.pagination, q).toEqual({ page: 1, limit: 2, total: 2, totalPages: 1 });
          expect(json.data).toHaveLength(2);
        }
        const paged = await (await list.GET(req('GET', '/api/admin/orders?page=abc&limit=1', admin.token))).json();
        expect(paged.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
      });
    });

    describe('authorize revert keeps notes', () => {
      for (const previous of [undefined, 'nota previa']) {
        it(`restores notes exactly (${previous === undefined ? 'unset' : 'set'}) after a standalone failure`, async () => {
          const admin = await makeUser('admin');
          const p = await makeProduct(10);
          const o = await makeOrder(p, { origin: 'web', status: 'pendiente', qty: 2 });
          if (previous === undefined) {
            await Order.collection.updateOne({ _id: o._id }, { $unset: { notes: '' } });
          } else {
            await Order.collection.updateOne({ _id: o._id }, { $set: { notes: previous } });
          }
          vi.spyOn(SalesRecord, 'create').mockRejectedValueOnce(new Error('boom'));
          const res = await authorize.POST(
            req('POST', `/api/admin/orders/${o._id}/authorize`, admin.token, {
              recordedPaymentMethod: 'efectivo',
              discountNote: 'descuento',
            }),
            ctx(String(o._id))
          );
          expect(res.status).toBe(500);
          const raw = await Order.collection.findOne({ _id: o._id });
          expect(raw!.status).toBe('pendiente');
          if (previous === undefined) expect('notes' in raw!).toBe(false);
          else expect(raw!.notes).toBe(previous);
          expect(raw!.history ?? []).toHaveLength(0);
          expect(await variantStock(p)).toBe(10);
        });
      }
    });

    describe('authorize', () => {
      it('a seller gets 403 and nothing changes', async () => {
        const s1 = await makeUser('seller');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { origin: 'web', status: 'pendiente', qty: 2 });
        const res = await authorize.POST(
          req('POST', `/api/admin/orders/${o._id}/authorize`, s1.token, { recordedPaymentMethod: 'efectivo' }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(403);
        expect(await variantStock(p)).toBe(10);
        expect((await Order.findById(o._id).lean())!.status).toBe('pendiente');
      });

      it('appends a status_changed history entry by the admin', async () => {
        const admin = await makeUser('admin', 'Jefa');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { origin: 'web', status: 'pendiente', qty: 2 });
        const res = await authorize.POST(
          req('POST', `/api/admin/orders/${o._id}/authorize`, admin.token, { recordedPaymentMethod: 'efectivo' }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(200);
        const saved = await Order.findById(o._id).lean();
        const h = saved!.history.find((e) => e.action === 'status_changed');
        expect(h!.byName).toBe('Jefa');
        expect((await Product.findById(p.productId).lean())!.totalStock).toBe(8);
      });

      it('a failure after the stock moved returns the stock and leaves the order pendiente, without leaking', async () => {
        const admin = await makeUser('admin');
        const p = await makeProduct(10);
        const o = await makeOrder(p, { origin: 'web', status: 'pendiente', qty: 2 });
        vi.spyOn(SalesRecord, 'create').mockRejectedValueOnce(new Error('secret driver text'));
        const res = await authorize.POST(
          req('POST', `/api/admin/orders/${o._id}/authorize`, admin.token, { recordedPaymentMethod: 'efectivo' }),
          ctx(String(o._id))
        );
        expect(res.status).toBe(500);
        expect(JSON.stringify(await res.json())).not.toContain('secret');
        expect(await variantStock(p)).toBe(10);
        expect((await Order.findById(o._id).lean())!.status).toBe('pendiente');
      });
    });
  });
}

describe('order-access', () => {
  it('ordersScope and canMutateOrder follow the rules', async () => {
    const { ordersScope, canMutateOrder } = await import('@/lib/order-access');
    const sellerId = String(new Types.ObjectId());
    const seller = { id: sellerId, username: 's', name: 'S', role: 'seller' as const };
    const admin = { id: String(new Types.ObjectId()), username: 'a', name: 'A', role: 'admin' as const };
    const other = String(new Types.ObjectId());

    expect(String(ordersScope(seller)['soldBy.userId' as never])).toBe(sellerId);
    expect(String(ordersScope(seller, 'web')['soldBy.userId' as never])).toBe(sellerId);
    expect(String(ordersScope(seller, other)['soldBy.userId' as never])).toBe(sellerId);
    expect(ordersScope(admin)).toEqual({});
    expect(ordersScope(admin, 'web')).toEqual({ origin: 'web' });
    expect(String(ordersScope(admin, other)['soldBy.userId' as never])).toBe(other);
    expect(ordersScope(admin, 'junk')).toEqual({});
    expect(ordersScope(admin, '{"$ne":null}')).toEqual({});

    const own = {
      origin: 'admin_direct',
      status: 'autorizado',
      soldBy: { userId: new Types.ObjectId(sellerId), username: 's', name: 'S' },
    } as never;
    expect(canMutateOrder(seller, own)).toBe(true);
    expect(canMutateOrder(seller, own, 'cancelado')).toBe(true);
    expect(canMutateOrder(seller, own, 'completada')).toBe(false);
    expect(canMutateOrder(seller, { ...(own as object), status: 'completada' } as never)).toBe(false);
    expect(canMutateOrder(seller, { ...(own as object), status: 'cancelado' } as never)).toBe(false);
    expect(canMutateOrder(seller, { ...(own as object), status: 'pendiente' } as never)).toBe(false);
    expect(canMutateOrder(seller, { ...(own as object), status: 'confirmada' } as never)).toBe(false);
    expect(canMutateOrder(seller, { ...(own as object), origin: 'web' } as never)).toBe(false);
    expect(
      canMutateOrder(seller, { ...(own as object), soldBy: { userId: new Types.ObjectId(other), username: 'o', name: 'O' } } as never)
    ).toBe(false);
    expect(canMutateOrder(seller, { origin: 'admin_direct', status: 'autorizado' } as never)).toBe(false);
    expect(canMutateOrder(admin, { ...(own as object), status: 'completada' } as never, 'completada')).toBe(true);
  });
});
