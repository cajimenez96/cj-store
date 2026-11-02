import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';
import { signAdminToken } from '@/lib/jwt';

/**
 * Handler-level tests for seller access to stock and product reads. Handlers are
 * called directly (middleware bypassed), so every role rule lives in the handlers.
 */

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:1/unused';

type Role = 'admin' | 'superadmin' | 'seller';

let stockRoute: typeof import('../route');
let productsRoute: typeof import('../../products/route');
let productDetailRoute: typeof import('../../products/[id]/route');
let productStockRoute: typeof import('../../products/[id]/stock/route');
let Product: typeof import('@/models/Product').default;
let User: typeof import('@/models/User').default;

let stop: () => Promise<unknown>;
const tokens: Record<Role, string> = { admin: '', superadmin: '', seller: '' };

const COST_KEYS = [
  'costPrice',
  'cost',
  'purchasePrice',
  'supplier',
  'margin',
  'internalNotes',
  'notes',
];

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

function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => collectKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      collectKeys(v, out);
    }
  }
  return out;
}

async function makeUser(role: Role) {
  const user = await User.create({
    username: `${role}${Math.random().toString(36).slice(2, 8)}`,
    passwordHash: 'x',
    name: `Usuario ${role}`,
    role,
    active: true,
  });
  return signAdminToken({ id: String(user._id), username: user.username, role, name: user.name });
}

let activeId: string;
let inactiveId: string;
let variantId: string;

async function seed() {
  await Product.deleteMany({});
  const vId = new Types.ObjectId();
  const active = await Product.create({
    name: 'Zapato Activo',
    slug: 'zapato-activo',
    description: 'Descripcion larga',
    images: [{ url: 'http://img/a.jpg', isPrincipal: true, position: 0 }],
    active: true,
    wholesale: { enabled: true, minQty: 3 },
    retailPrice: 10000,
    wholesalePrice: 8000,
    priceRange: { min: 10000, max: 10000 },
    totalStock: 7,
    hasWholesale: true,
    variants: [
      {
        _id: vId,
        sku: 'ZA-1',
        name: 'Negro 40',
        options: [{ key: 'color', value: 'negro' }],
        retailPrice: 10000,
        wholesalePrice: 8000,
        stock: 7,
        active: true,
      },
    ],
  });
  const inactive = await Product.create({
    name: 'Zapato Oculto',
    slug: 'zapato-oculto',
    images: [],
    active: false,
    variants: [{ sku: 'ZO-1', options: [], retailPrice: 5000, stock: 2, active: true }],
  });
  // Cost data is not in the Mongoose schema: write it raw, as an admin tool or import could.
  await Product.collection.updateOne(
    { _id: active._id },
    {
      $set: {
        costPrice: 4000,
        supplier: 'Proveedor SA',
        internalNotes: 'no mostrar',
        'variants.0.costPrice': 4000,
      },
    }
  );
  activeId = String(active._id);
  inactiveId = String(inactive._id);
  variantId = String(vId);
}

async function variantStock() {
  const p = await Product.findById(activeId).lean();
  return p?.variants?.find((v) => String(v._id) === variantId)?.stock;
}

describe('seller read-only stock and restricted product reads', () => {
  beforeAll(async () => {
    stockRoute = await import('../route');
    productsRoute = await import('../../products/route');
    productDetailRoute = await import('../../products/[id]/route');
    productStockRoute = await import('../../products/[id]/stock/route');
    Product = (await import('@/models/Product')).default;
    User = (await import('@/models/User')).default;
    const server = await MongoMemoryServer.create();
    stop = () => server.stop();
    await mongoose.connect(server.getUri('stock-test'));
    globalThis.mongooseCache!.conn = mongoose;
    globalThis.mongooseCache!.promise = Promise.resolve(mongoose);
    await Promise.all([Product.init(), User.init()]);
    for (const r of ['admin', 'superadmin', 'seller'] as Role[]) tokens[r] = await makeUser(r);
  }, 120000);

  afterAll(async () => {
    await mongoose.disconnect();
    globalThis.mongooseCache!.conn = null;
    globalThis.mongooseCache!.promise = null;
    await stop();
  });

  beforeEach(async () => {
    await seed();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('GET /api/admin/stock', () => {
    it('401 without session', async () => {
      expect((await stockRoute.GET(req('GET', '/api/admin/stock'))).status).toBe(401);
    });
    it.each(['admin', 'superadmin', 'seller'] as Role[])('200 for %s', async (role) => {
      const res = await stockRoute.GET(req('GET', '/api/admin/stock', tokens[role]));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.items).toHaveLength(2);
      const keys = collectKeys(json);
      for (const k of COST_KEYS) expect(keys.has(k)).toBe(false);
    });
  });

  describe('PUT /api/admin/stock', () => {
    const body = () => ({ productId: activeId, variantId, newStock: 99 });
    it('401 without session, nothing written', async () => {
      const res = await stockRoute.PUT(req('PUT', '/api/admin/stock', undefined, body()));
      expect(res.status).toBe(401);
      expect(await variantStock()).toBe(7);
    });
    it('403 for seller, nothing written', async () => {
      const res = await stockRoute.PUT(req('PUT', '/api/admin/stock', tokens.seller, body()));
      expect(res.status).toBe(403);
      expect((await res.json()).ok).toBe(false);
      expect(await variantStock()).toBe(7);
    });
    it.each(['admin', 'superadmin'] as Role[])('still works for %s', async (role) => {
      const res = await stockRoute.PUT(req('PUT', '/api/admin/stock', tokens[role], body()));
      expect(res.status).toBe(200);
      expect(await variantStock()).toBe(99);
    });
  });

  describe('PATCH /api/admin/products/[id]/stock', () => {
    const body = () => ({ variantId, stock: 55 });
    it('401 without session, nothing written', async () => {
      const res = await productStockRoute.PATCH(
        req('PATCH', `/x`, undefined, body()),
        ctx(activeId)
      );
      expect(res.status).toBe(401);
      expect(await variantStock()).toBe(7);
    });
    it('403 for seller, nothing written', async () => {
      const res = await productStockRoute.PATCH(req('PATCH', `/x`, tokens.seller, body()), ctx(activeId));
      expect(res.status).toBe(403);
      expect(await variantStock()).toBe(7);
    });
    it('still works for admin', async () => {
      const res = await productStockRoute.PATCH(req('PATCH', `/x`, tokens.admin, body()), ctx(activeId));
      expect(res.status).toBe(200);
      expect(await variantStock()).toBe(55);
    });
  });

  describe('GET /api/admin/products', () => {
    it('401 without session', async () => {
      expect((await productsRoute.GET(req('GET', '/api/admin/products'))).status).toBe(401);
    });

    it('admin response has not drifted (full lean documents incl. cost data)', async () => {
      const res = await productsRoute.GET(req('GET', '/api/admin/products', tokens.admin));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.pagination).toEqual({ page: 1, limit: 2, total: 2, totalPages: 1 });
      expect(json.data).toHaveLength(2);
      const a = json.data.find((p: { name: string }) => p.name === 'Zapato Activo');
      expect(Object.keys(a).sort()).toEqual(
        [
          '__v', '_id', 'active', 'categoryAncestors', 'costPrice', 'createdAt', 'description',
          'hasWholesale', 'images', 'internalNotes', 'isClearance', 'name', 'priceRange',
          'retailPrice', 'slug', 'specs', 'stock', 'supplier', 'totalStock', 'updatedAt',
          'variants', 'wholesale', 'wholesalePrice',
        ].sort()
      );
      expect(a.costPrice).toBe(4000);
      expect(a.variants[0].costPrice).toBe(4000);
      expect(a.totalStock).toBe(7);
      // admin may still request inactive products
      const inactive = await productsRoute.GET(req('GET', '/api/admin/products?active=false', tokens.admin));
      expect((await inactive.json()).data.map((p: { name: string }) => p.name)).toEqual(['Zapato Oculto']);
    });

    it('seller gets 200 with prices, variants and stock but no cost/admin-only data', async () => {
      const res = await productsRoute.GET(req('GET', '/api/admin/products?search=Zapato', tokens.seller));
      expect(res.status).toBe(200);
      const json = await res.json();
      const keys = collectKeys(json);
      for (const k of [...COST_KEYS, 'description', 'specs', 'categoryAncestors', 'createdAt', 'updatedAt', '__v']) {
        expect(keys.has(k)).toBe(false);
      }
      expect(json.data).toHaveLength(1);
      const p = json.data[0];
      expect(p._id).toBe(activeId);
      expect(p.name).toBe('Zapato Activo');
      expect(p.retailPrice).toBe(10000);
      expect(p.wholesalePrice).toBe(8000);
      expect(p.totalStock).toBe(7);
      expect(p.images[0].url).toBe('http://img/a.jpg');
      expect(p.variants).toHaveLength(1);
      expect(p.variants[0]).toMatchObject({
        _id: variantId,
        sku: 'ZA-1',
        name: 'Negro 40',
        retailPrice: 10000,
        wholesalePrice: 8000,
        stock: 7,
        active: true,
        options: [{ key: 'color', value: 'negro' }],
      });
      expect(json.pagination.total).toBe(1);
    });

    it.each(['?active=false', '', '?active='])('seller only sees active products (%s)', async (qs) => {
      const res = await productsRoute.GET(req('GET', `/api/admin/products${qs}`, tokens.seller));
      const json = await res.json();
      expect(json.data.map((p: { name: string }) => p.name)).toEqual(['Zapato Activo']);
      expect(json.pagination.total).toBe(1);
    });
  });

  describe('other product endpoints stay admin-only', () => {
    it('seller GET products/[id] -> 403', async () => {
      const res = await productDetailRoute.GET(req('GET', '/x', tokens.seller), ctx(activeId));
      expect(res.status).toBe(403);
    });
    it('no session GET products/[id] -> 401', async () => {
      const res = await productDetailRoute.GET(req('GET', '/x'), ctx(activeId));
      expect(res.status).toBe(401);
    });
    it('admin GET products/[id] still works and includes cost data', async () => {
      const res = await productDetailRoute.GET(req('GET', '/x', tokens.admin), ctx(activeId));
      expect(res.status).toBe(200);
      expect((await res.json()).data.costPrice).toBe(4000);
    });
    it('seller POST products -> 403, nothing created', async () => {
      const res = await productsRoute.POST(
        req('POST', '/api/admin/products', tokens.seller, {
          name: 'Nuevo', images: [{ url: 'http://x/y.jpg', isPrincipal: true, position: 0 }],
        })
      );
      expect(res.status).toBe(403);
      expect(await Product.countDocuments({ name: 'Nuevo' })).toBe(0);
    });
    it('seller PUT products -> 403, product unchanged', async () => {
      const res = await productsRoute.PUT(
        req('PUT', '/api/admin/products', tokens.seller, { _id: activeId, name: 'Hack' })
      );
      expect(res.status).toBe(403);
      expect((await Product.findById(activeId))?.name).toBe('Zapato Activo');
    });
    it('seller DELETE products -> 403, product untouched', async () => {
      const res = await productsRoute.DELETE(
        req('DELETE', `/api/admin/products?id=${activeId}&permanent=true`, tokens.seller)
      );
      expect(res.status).toBe(403);
      expect(await Product.countDocuments({ _id: activeId })).toBe(1);
      expect(inactiveId).toBeTruthy();
    });
  });
});
