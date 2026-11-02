import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';
import { signAdminToken } from '@/lib/jwt';
import type { OrderStatus } from '@/models/Order';
import type { ExpenseCategory } from '@/models/Expense';

/**
 * Handler-level tests for the admin accounting API. The handler is called
 * directly, so authentication, scoping and the seller/admin response shape
 * must live in the handler itself. Read-only, so one in-memory server is enough.
 */

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:1/unused';

type Route = typeof import('../route');
let route: Route;
let Order: typeof import('@/models/Order').default;
let Expense: typeof import('@/models/Expense').default;
let User: typeof import('@/models/User').default;

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
  return { user, token, id: String(user._id), name, username: user.username };
}
type U = Awaited<ReturnType<typeof makeUser>>;

interface ItemOpts {
  qty: number;
  unitPrice: number;
  listPrice?: number;
}
interface OrderOpts {
  status?: OrderStatus;
  origin?: 'web' | 'admin_direct';
  soldBy?: U | null;
  items?: ItemOpts[];
  discount?: number;
  paymentMethod?: 'efectivo' | 'transferencia';
  createdAt?: Date;
}

let orderSeq = 0;
async function makeOrder(opts: OrderOpts = {}) {
  const items = opts.items ?? [{ qty: 2, unitPrice: 10000 }];
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const discount = opts.discount ?? 0;
  orderSeq += 1;
  return Order.create({
    orderNumber: `PED-ACC-${orderSeq}-${Math.random().toString(36).slice(2, 6)}`,
    origin: opts.origin ?? 'admin_direct',
    guest: { name: 'Ana', lastName: 'Pérez', phone: '1122334455' },
    items: items.map((i) => ({
      productId: new Types.ObjectId(),
      name: 'Zapato Test',
      qty: i.qty,
      ...(i.listPrice !== undefined ? { listPrice: i.listPrice } : {}),
      appliedPriceType: 'retail',
      unitPrice: i.unitPrice,
      subtotal: i.qty * i.unitPrice,
    })),
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
    paymentMethod: opts.paymentMethod ?? 'efectivo',
    status: opts.status ?? 'autorizado',
    ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    ...(opts.soldBy
      ? { soldBy: { userId: opts.soldBy.user._id, username: opts.soldBy.username, name: opts.soldBy.name } }
      : {}),
  });
}

async function makeExpense(
  amount: number,
  category: ExpenseCategory,
  paymentMethod: 'efectivo' | 'transferencia',
  date: Date
) {
  return Expense.create({ concept: `Gasto ${category}`, category, amount, paymentMethod, date });
}

function get(query: string, token?: string) {
  return new NextRequest(`http://localhost/api/admin/accounting${query}`, {
    method: 'GET',
    headers: token ? { cookie: `admin_token=${token}` } : {},
  });
}

// A fixed past month (June 2025), dates are local-time like the route's own range.
const JUNE = '?month=6&year=2025';
const d = (day: number, h = 12, m = 0) => new Date(2025, 5, day, h, m, 0, 0);

describe('admin accounting API', () => {
  let stop: () => Promise<unknown>;

  beforeAll(async () => {
    route = await import('../route');
    Order = (await import('@/models/Order')).default;
    Expense = (await import('@/models/Expense')).default;
    User = (await import('@/models/User')).default;

    const server = await MongoMemoryServer.create();
    stop = () => server.stop();
    await mongoose.connect(server.getUri('accounting'));
    globalThis.mongooseCache!.conn = mongoose;
    globalThis.mongooseCache!.promise = Promise.resolve(mongoose);
    await Promise.all([Order.init(), Expense.init(), User.init()]);
  }, 120000);

  afterAll(async () => {
    await mongoose.disconnect();
    globalThis.mongooseCache!.conn = null;
    globalThis.mongooseCache!.promise = null;
    await stop();
  });

  beforeEach(async () => {
    await Promise.all([Order.deleteMany({}), Expense.deleteMany({}), User.deleteMany({})]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('existing admin response (no drift)', () => {
    it('keeps every pre-existing field and value for a mixed dataset', async () => {
      const admin = await makeUser('admin');
      const seller = await makeUser('seller');
      const web = await makeOrder({ origin: 'web', createdAt: d(10), items: [{ qty: 2, unitPrice: 10000 }] });
      const direct = await makeOrder({
        soldBy: seller,
        paymentMethod: 'transferencia',
        discount: 1000,
        createdAt: d(15),
        items: [{ qty: 1, unitPrice: 15000, listPrice: 15000 }],
      });
      await makeOrder({ status: 'cancelada', createdAt: d(11) });
      await makeOrder({ status: 'pendiente', createdAt: d(12) });
      await makeOrder({ createdAt: new Date(2025, 4, 31, 12) });
      await makeExpense(5000, 'mercaderia', 'efectivo', d(5));
      await makeExpense(3000, 'servicios', 'transferencia', d(20));
      await makeExpense(1000, 'otros', 'efectivo', d(25));
      await makeExpense(7777, 'otros', 'efectivo', new Date(2025, 6, 1, 12));

      const res = await route.GET(get(JUNE, admin.token));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      const data = body.data;

      expect(data.period.month).toBe(6);
      expect(data.period.year).toBe(2025);
      expect(new Date(data.period.startDate).getTime()).toBe(new Date(2025, 5, 1, 0, 0, 0, 0).getTime());
      expect(new Date(data.period.endDate).getTime()).toBe(new Date(2025, 6, 0, 23, 59, 59, 999).getTime());
      expect(data.summary).toEqual({
        incomeTotal: 34000,
        incomeCash: 20000,
        incomeTransfer: 14000,
        expenseTotal: 9000,
        expenseCash: 6000,
        expenseTransfer: 3000,
        netBalance: 25000,
        netCash: 14000,
        netTransfer: 11000,
        totalOrdersCount: 2,
        totalPairsSold: 3,
        averageTicket: 17000,
        expensesByCategory: {
          mercaderia: 5000,
          logistica: 0,
          servicios: 3000,
          marketing: 0,
          alquiler: 0,
          sueldos: 0,
          otros: 1000,
        },
      });
      // transactions: newest first, orders and expenses merged
      expect(data.transactions.map((t: { type: string; amount: number }) => [t.type, t.amount])).toEqual([
        ['egreso', 1000],
        ['egreso', 3000],
        ['ingreso', 14000],
        ['ingreso', 20000],
        ['egreso', 5000],
      ]);
      const ing = data.transactions.find((t: { id: string }) => t.id === String(direct._id));
      expect(ing).toMatchObject({
        type: 'ingreso',
        concept: `Venta #${direct.orderNumber} - Ana Pérez`,
        category: 'Venta de Productos',
        amount: 14000,
        paymentMethod: 'transferencia',
        details: '1 unidades',
      });
      expect(data.transactions.find((t: { id: string }) => t.id === String(web._id)).details).toBe('2 unidades');
      const egr = data.transactions.find((t: { type: string; amount: number }) => t.type === 'egreso' && t.amount === 3000);
      expect(egr).toMatchObject({ concept: 'Gasto servicios', category: 'servicios', paymentMethod: 'transferencia' });
      expect(data.expenses).toHaveLength(3);
      expect(data.expenses.map((e: { amount: number }) => e.amount)).toEqual([1000, 3000, 5000]);
    });
  });

  describe('authentication', () => {
    it('returns 401 without a session', async () => {
      const res = await route.GET(get(JUNE));
      expect(res.status).toBe(401);
      expect((await res.json()).ok).toBe(false);
    });

    it('returns 401 with a garbage token', async () => {
      const res = await route.GET(get(JUNE, 'not-a-jwt'));
      expect(res.status).toBe(401);
    });
  });

  describe('seller scope', () => {
    async function seed() {
      const admin = await makeUser('admin');
      const s1 = await makeUser('seller', 'Vendedor Uno');
      const s2 = await makeUser('seller', 'Vendedor Dos');
      await makeOrder({ soldBy: s1, createdAt: d(10), items: [{ qty: 1, unitPrice: 10000 }] }); // 10000
      await makeOrder({ soldBy: s1, createdAt: d(11), items: [{ qty: 2, unitPrice: 5000 }], paymentMethod: 'transferencia' }); // 10000
      await makeOrder({ soldBy: s2, createdAt: d(12), items: [{ qty: 3, unitPrice: 20000 }] }); // 60000
      await makeOrder({ soldBy: admin, createdAt: d(13), items: [{ qty: 1, unitPrice: 7000 }] });
      await makeOrder({ origin: 'web', createdAt: d(14), items: [{ qty: 1, unitPrice: 9000 }] });
      await makeOrder({ soldBy: s1, status: 'cancelada', createdAt: d(15), items: [{ qty: 9, unitPrice: 9999 }] });
      await makeOrder({ soldBy: s1, status: 'cancelado', createdAt: d(15), items: [{ qty: 9, unitPrice: 9999 }] });
      await makeOrder({ soldBy: s1, status: 'pendiente', createdAt: d(16), items: [{ qty: 9, unitPrice: 9999 }] });
      await makeExpense(4000, 'mercaderia', 'efectivo', d(5));
      return { admin, s1, s2 };
    }

    it('returns only their own totals, ignoring cancelled and non-accounting statuses', async () => {
      const { s1 } = await seed();
      const res = await route.GET(get(JUNE, s1.token));
      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.summary).toMatchObject({
        incomeTotal: 20000,
        incomeCash: 10000,
        incomeTransfer: 10000,
        totalOrdersCount: 2,
        totalPairsSold: 3,
        averageTicket: 10000,
      });
      expect(data.transactions).toHaveLength(2);
      expect(data.transactions.every((t: { type: string }) => t.type === 'ingreso')).toBe(true);
    });

    it('ignores ?userId=<other seller>, ?userId=web, junk and repeated params', async () => {
      const { s1, s2 } = await seed();
      const queries = [
        `${JUNE}&userId=${s2.id}`,
        `${JUNE}&userId=web`,
        `${JUNE}&userId[$ne]=${s1.id}`,
        `${JUNE}&userId=${s2.id}&userId=${s1.id}`,
        `${JUNE}&userId=${s1.id}&userId=${s2.id}`,
        `${JUNE}&userId=%7B%22%24ne%22%3Anull%7D`,
      ];
      for (const q of queries) {
        const res = await route.GET(get(q, s1.token));
        expect(res.status, q).toBe(200);
        const { data } = await res.json();
        expect(data.summary.incomeTotal, q).toBe(20000);
        expect(data.summary.totalOrdersCount, q).toBe(2);
      }
    });

    it('does not expose expenses, net income, bySeller or expense transactions', async () => {
      const { s1 } = await seed();
      const { data } = await (await route.GET(get(JUNE, s1.token))).json();
      expect(data).not.toHaveProperty('expenses');
      expect(data).not.toHaveProperty('bySeller');
      expect(Object.keys(data.summary).sort()).toEqual(
        ['averageTicket', 'incomeCash', 'incomeTotal', 'incomeTransfer', 'totalOrdersCount', 'totalPairsSold'].sort()
      );
      expect(Object.keys(data).sort()).toEqual(['deviation', 'period', 'summary', 'transactions']);
      expect(data.transactions.some((t: { type: string }) => t.type === 'egreso')).toBe(false);
    });

    it('never queries the Expense collection', async () => {
      const { s1 } = await seed();
      const spy = vi.spyOn(Expense, 'find');
      const res = await route.GET(get(JUNE, s1.token));
      expect(res.status).toBe(200);
      expect(spy).not.toHaveBeenCalled();
    });

    it('a seller with no sales gets zeros, not an error', async () => {
      const s = await makeUser('seller');
      const { data } = await (await route.GET(get(JUNE, s.token))).json();
      expect(data.summary.incomeTotal).toBe(0);
      expect(data.summary.averageTicket).toBe(0);
      expect(data.deviation).toEqual({ above: 0, below: 0 });
    });
  });

  describe('deviation', () => {
    it('sums above/below over items with listPrice, ignoring equal and legacy items', async () => {
      const admin = await makeUser('admin');
      await makeOrder({
        createdAt: d(10),
        items: [
          { qty: 2, unitPrice: 12000, listPrice: 10000 }, // +4000 above
          { qty: 3, unitPrice: 8000, listPrice: 9000 }, // 3000 below
          { qty: 5, unitPrice: 7000, listPrice: 7000 }, // equal
          { qty: 4, unitPrice: 1, /* legacy: no listPrice */ },
        ],
      });
      await makeOrder({
        createdAt: d(11),
        items: [
          { qty: 1, unitPrice: 10500, listPrice: 10000 }, // +500
          { qty: 2, unitPrice: 9500, listPrice: 10000 }, // 1000 below
        ],
      });
      const { data } = await (await route.GET(get(JUNE, admin.token))).json();
      expect(data.deviation).toEqual({ above: 4500, below: 4000 });
    });

    it('does not count the order-level discount', async () => {
      const admin = await makeUser('admin');
      await makeOrder({
        createdAt: d(10),
        discount: 3000,
        items: [{ qty: 2, unitPrice: 10000, listPrice: 10000 }],
      });
      const { data } = await (await route.GET(get(JUNE, admin.token))).json();
      expect(data.deviation).toEqual({ above: 0, below: 0 });
      expect(data.summary.incomeTotal).toBe(17000);
    });

    it('is scoped for a seller and excludes cancelled orders', async () => {
      const s1 = await makeUser('seller');
      const s2 = await makeUser('seller');
      await makeOrder({ soldBy: s1, createdAt: d(10), items: [{ qty: 1, unitPrice: 11000, listPrice: 10000 }] });
      await makeOrder({ soldBy: s2, createdAt: d(10), items: [{ qty: 1, unitPrice: 20000, listPrice: 10000 }] });
      await makeOrder({
        soldBy: s1,
        status: 'cancelada',
        createdAt: d(10),
        items: [{ qty: 1, unitPrice: 30000, listPrice: 10000 }],
      });
      const { data } = await (await route.GET(get(JUNE, s1.token))).json();
      expect(data.deviation).toEqual({ above: 1000, below: 0 });
    });
  });

  describe('admin bySeller and filters', () => {
    async function seed() {
      const admin = await makeUser('admin', 'Admin Principal');
      const s1 = await makeUser('seller', 'Vendedor Uno');
      const s2 = await makeUser('seller', 'Vendedor Dos');
      await makeOrder({ origin: 'web', createdAt: d(2), items: [{ qty: 1, unitPrice: 9000 }] });
      await makeOrder({ origin: 'web', createdAt: d(3), items: [{ qty: 2, unitPrice: 3000 }] });
      await makeOrder({
        soldBy: s1,
        createdAt: d(4),
        items: [{ qty: 2, unitPrice: 12000, listPrice: 10000 }],
      }); // 24000, above 4000
      await makeOrder({
        soldBy: s1,
        createdAt: d(5),
        items: [{ qty: 1, unitPrice: 9000, listPrice: 10000 }],
      }); // 9000, below 1000
      await makeOrder({ soldBy: s2, createdAt: d(6), items: [{ qty: 3, unitPrice: 20000 }] }); // 60000
      await makeOrder({ soldBy: admin, createdAt: d(7), items: [{ qty: 1, unitPrice: 7000 }] }); // admin POS
      await makeOrder({ soldBy: s2, status: 'cancelada', createdAt: d(8), items: [{ qty: 1, unitPrice: 50000 }] });
      await makeExpense(1000, 'otros', 'efectivo', d(9));
      return { admin, s1, s2 };
    }

    it('groups by seller, web under "web", admin POS under the admin, sorted by totalSold desc', async () => {
      const { admin, s1, s2 } = await seed();
      const { data } = await (await route.GET(get(JUNE, admin.token))).json();
      expect(data.bySeller).toEqual([
        { userId: s2.id, name: 'Vendedor Dos', totalSold: 60000, salesCount: 1, units: 3, above: 0, below: 0 },
        { userId: s1.id, name: 'Vendedor Uno', totalSold: 33000, salesCount: 2, units: 3, above: 4000, below: 1000 },
        { userId: 'web', name: 'Web', totalSold: 15000, salesCount: 2, units: 3, above: 0, below: 0 },
        { userId: admin.id, name: 'Admin Principal', totalSold: 7000, salesCount: 1, units: 1, above: 0, below: 0 },
      ]);
      expect(data.deviation).toEqual({ above: 4000, below: 1000 });
      expect(data.summary.incomeTotal).toBe(115000);
      expect(data.expenses).toHaveLength(1);
    });

    it('?userId=<seller> filters summary, bySeller and deviation', async () => {
      const { admin, s1 } = await seed();
      const { data } = await (await route.GET(get(`${JUNE}&userId=${s1.id}`, admin.token))).json();
      expect(data.summary.incomeTotal).toBe(33000);
      expect(data.summary.totalOrdersCount).toBe(2);
      expect(data.bySeller).toHaveLength(1);
      expect(data.bySeller[0]).toMatchObject({ userId: s1.id, totalSold: 33000 });
      expect(data.deviation).toEqual({ above: 4000, below: 1000 });
    });

    it('?userId=web returns only web orders grouped under "web"', async () => {
      const { admin } = await seed();
      const { data } = await (await route.GET(get(`${JUNE}&userId=web`, admin.token))).json();
      expect(data.summary.incomeTotal).toBe(15000);
      expect(data.bySeller).toEqual([
        { userId: 'web', name: 'Web', totalSold: 15000, salesCount: 2, units: 3, above: 0, below: 0 },
      ]);
    });

    it('legacy direct sales (no soldBy) get their own row, apart from web; ?userId=legacy filters them', async () => {
      const { admin, s1, s2 } = await seed();
      await makeOrder({ origin: 'admin_direct', createdAt: d(10), items: [{ qty: 1, unitPrice: 5000 }] });
      await makeOrder({ origin: 'admin_direct', createdAt: d(11), items: [{ qty: 2, unitPrice: 4000, listPrice: 5000 }] });

      const all = (await (await route.GET(get(JUNE, admin.token))).json()).data;
      expect(all.bySeller).toEqual([
        { userId: s2.id, name: 'Vendedor Dos', totalSold: 60000, salesCount: 1, units: 3, above: 0, below: 0 },
        { userId: s1.id, name: 'Vendedor Uno', totalSold: 33000, salesCount: 2, units: 3, above: 4000, below: 1000 },
        { userId: 'web', name: 'Web', totalSold: 15000, salesCount: 2, units: 3, above: 0, below: 0 },
        { userId: 'legacy', name: 'Admin (sin registro)', totalSold: 13000, salesCount: 2, units: 3, above: 0, below: 2000 },
        { userId: admin.id, name: 'Admin Principal', totalSold: 7000, salesCount: 1, units: 1, above: 0, below: 0 },
      ]);

      const web = (await (await route.GET(get(`${JUNE}&userId=web`, admin.token))).json()).data;
      expect(web.summary.incomeTotal).toBe(15000);
      expect(web.bySeller).toEqual([all.bySeller[2]]);

      const legacy = (await (await route.GET(get(`${JUNE}&userId=legacy`, admin.token))).json()).data;
      expect(legacy.summary.incomeTotal).toBe(13000);
      expect(legacy.summary.totalOrdersCount).toBe(2);
      expect(legacy.bySeller).toEqual([all.bySeller[3]]);
      expect(legacy.deviation).toEqual({ above: 0, below: 2000 });

      // A seller's ?userId=legacy is ignored: own sales only.
      const own = (await (await route.GET(get(`${JUNE}&userId=legacy`, s1.token))).json()).data;
      expect(own.summary.incomeTotal).toBe(33000);
    });

    it('a junk userId is ignored for admins (all orders)', async () => {
      const { admin } = await seed();
      const { data } = await (await route.GET(get(`${JUNE}&userId[$ne]=x`, admin.token))).json();
      expect(data.summary.incomeTotal).toBe(115000);
    });

    it('superadmin gets the admin response', async () => {
      await seed();
      const sa = await makeUser('superadmin');
      const { data } = await (await route.GET(get(JUNE, sa.token))).json();
      expect(data).toHaveProperty('bySeller');
      expect(data).toHaveProperty('expenses');
    });
  });

  describe('period handling', () => {
    it('includes 23:59 of the last day and excludes 00:00 of the next month', async () => {
      const admin = await makeUser('admin');
      await makeOrder({ createdAt: new Date(2025, 5, 30, 23, 59, 0, 0), items: [{ qty: 1, unitPrice: 1000 }] });
      await makeOrder({ createdAt: new Date(2025, 6, 1, 0, 0, 0, 0), items: [{ qty: 1, unitPrice: 2000 }] });
      await makeOrder({ createdAt: new Date(2025, 5, 1, 0, 0, 0, 0), items: [{ qty: 1, unitPrice: 4000 }] });
      await makeOrder({ createdAt: new Date(2025, 4, 31, 23, 59, 0, 0), items: [{ qty: 1, unitPrice: 8000 }] });
      const { data } = await (await route.GET(get(JUNE, admin.token))).json();
      expect(data.summary.incomeTotal).toBe(5000);
      const july = await (await route.GET(get('?month=7&year=2025', admin.token))).json();
      expect(july.data.summary.incomeTotal).toBe(2000);
    });

    it('falls back to the current month/year on invalid month/year instead of failing', async () => {
      const admin = await makeUser('admin');
      const now = new Date();
      for (const q of ['?month=abc&year=xyz', '?month=13&year=2025', '?month=0', '?month=6&year=99999999', '?month=&year=']) {
        const res = await route.GET(get(q, admin.token));
        expect(res.status, q).toBe(200);
        const { data } = await res.json();
        expect(Number.isFinite(data.period.month), q).toBe(true);
        expect(data.period.month, q).toBeGreaterThanOrEqual(1);
        expect(data.period.month, q).toBeLessThanOrEqual(12);
        expect(Number.isNaN(new Date(data.period.startDate).getTime()), q).toBe(false);
      }
      const { data } = await (await route.GET(get('?month=abc&year=xyz', admin.token))).json();
      expect(data.period).toMatchObject({ month: now.getMonth() + 1, year: now.getFullYear() });
    });
  });
});
