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
      expect(json.data.items).toHaveLength(role === 'seller' ? 1 : 2);
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

  describe('seller sanitizer is strict at every nesting level', () => {
    it('drops raw extras nested in wholesale, priceRange, options, images, brandId, categoryId', async () => {
      const Brand = (await import('@/models/Brand')).default;
      const Category = (await import('@/models/Category')).default;
      const brandId = new Types.ObjectId();
      const categoryId = new Types.ObjectId();
      await Brand.collection.insertOne({ _id: brandId, name: 'Marca', slug: 'marca', cost: 1, supplier: 'S' });
      await Category.collection.insertOne({
        _id: categoryId, name: 'Cat', slug: 'cat', variantAxes: ['color'], cost: 1, margin: 2,
      });
      await Product.collection.insertOne({
        name: 'Nested Extras', slug: 'nested-extras', active: true, brandId, categoryId,
        wholesale: { enabled: true, minQty: 3, cost: 111 },
        priceRange: { min: 1, max: 2, costMin: 3 },
        images: [{ _id: new Types.ObjectId(), url: 'u', isPrincipal: true, position: 0, axisValue: 'x', fileId: 'f', cost: 9 }],
        variants: [{
          _id: new Types.ObjectId(), sku: 'N-1', name: 'n', retailPrice: 1, wholesalePrice: 1, stock: 1, active: true,
          options: [{ key: 'color', value: 'rojo', cost: 5 }], costPrice: 7,
        }],
        retailPrice: 1, wholesalePrice: 1, totalStock: 1, hasWholesale: true, createdAt: new Date(),
      });
      const res = await productsRoute.GET(req('GET', '/api/admin/products?search=Nested', tokens.seller));
      const json = await res.json();
      const p = json.data[0];
      const keys = (o: object) => Object.keys(o).sort();
      expect(keys(p)).toEqual(
        ['_id', 'active', 'brandId', 'categoryId', 'hasWholesale', 'images', 'name', 'priceRange',
          'retailPrice', 'slug', 'totalStock', 'variants', 'wholesale', 'wholesalePrice'].sort()
      );
      expect(keys(p.wholesale)).toEqual(['enabled', 'minQty']);
      expect(keys(p.priceRange)).toEqual(['max', 'min']);
      expect(keys(p.images[0])).toEqual(['_id', 'axisValue', 'isPrincipal', 'position', 'url']);
      expect(keys(p.variants[0])).toEqual(
        ['_id', 'active', 'name', 'options', 'retailPrice', 'sku', 'stock', 'wholesalePrice']
      );
      expect(p.variants[0].options).toEqual([{ key: 'color', value: 'rojo' }]);
      expect(p.brandId).toEqual({ _id: String(brandId), name: 'Marca' });
      expect(keys(p.categoryId)).toEqual(['_id', 'name', 'slug', 'variantAxes']);
      const all = collectKeys(json);
      for (const k of ['cost', 'costMin', 'costPrice', 'supplier', 'margin', 'fileId']) {
        expect(all.has(k)).toBe(false);
      }
    });
  });

  describe('seller stock view hides inactive products', () => {
    it('excludes inactive product and its numbers for seller; admin still sees it', async () => {
      const sellerJson = await (await stockRoute.GET(req('GET', '/api/admin/stock', tokens.seller))).json();
      expect(sellerJson.data.items.map((i: { name: string }) => i.name)).toEqual(['Zapato Activo']);
      expect(sellerJson.data.totalProductsCount).toBe(1);
      expect(sellerJson.data.totalUnitsInStock).toBe(7);
      const adminJson = await (await stockRoute.GET(req('GET', '/api/admin/stock', tokens.admin))).json();
      expect(adminJson.data.items.map((i: { name: string }) => i.name).sort()).toEqual(['Zapato Activo', 'Zapato Oculto']);
      expect(adminJson.data.totalProductsCount).toBe(2);
      expect(adminJson.data.totalUnitsInStock).toBe(9);
    });
  });

  describe('write verbs without session', () => {
    it('401 and nothing created/changed for POST, PUT, DELETE products', async () => {
      const post = await productsRoute.POST(req('POST', '/api/admin/products', undefined, {
        name: 'Nuevo', images: [{ url: 'http://x/y.jpg', isPrincipal: true, position: 0 }],
      }));
      const put = await productsRoute.PUT(req('PUT', '/api/admin/products', undefined, { _id: activeId, name: 'Hack' }));
      const del = await productsRoute.DELETE(req('DELETE', `/api/admin/products?id=${activeId}&permanent=true`));
      expect([post.status, put.status, del.status]).toEqual([401, 401, 401]);
      expect(await Product.countDocuments({ name: 'Nuevo' })).toBe(0);
      expect((await Product.findById(activeId))?.name).toBe('Zapato Activo');
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

  describe('PUT /api/admin/products keeps live stock of existing variants', () => {
    it('ignores a stale form stock for an existing variant while updating its price; a new variant takes its form stock', async () => {
      // The form was opened with stock 7; meanwhile a sale left 4 units.
      await Product.updateOne({ _id: activeId, 'variants._id': variantId }, { $set: { 'variants.$.stock': 4 } });

      const res = await productsRoute.PUT(
        req('PUT', '/api/admin/products', tokens.admin, {
          _id: activeId,
          variants: [
            {
              _id: variantId,
              sku: 'ZA-1',
              options: [{ key: 'color', value: 'negro' }],
              retailPrice: 12500,
              wholesalePrice: 8000,
              stock: 7,
              active: true,
            },
            { sku: 'ZA-2', options: [{ key: 'color', value: 'rojo' }], retailPrice: 11000, stock: 5, active: true },
          ],
          stock: 12,
        })
      );
      expect(res.status).toBe(200);

      const saved = await Product.findById(activeId).lean();
      const existing = saved!.variants!.find((v) => String(v._id) === variantId)!;
      expect(existing.stock).toBe(4);
      expect(existing.retailPrice).toBe(12500);
      const added = saved!.variants!.find((v) => v.sku === 'ZA-2')!;
      expect(added.stock).toBe(5);
      expect(saved!.totalStock).toBe(9);
    });

    it('keeps the stored product-level stock of a product without variants', async () => {
      const legacy = await Product.create({
        name: 'Producto Simple',
        slug: 'producto-simple',
        images: [],
        active: true,
        retailPrice: 3000,
        stock: 2,
        totalStock: 2,
      });
      const res = await productsRoute.PUT(
        req('PUT', '/api/admin/products', tokens.admin, { _id: String(legacy._id), retailPrice: 3500, stock: 9 })
      );
      expect(res.status).toBe(200);
      const saved = await Product.findById(legacy._id).lean();
      expect(saved!.stock).toBe(2);
      expect(saved!.retailPrice).toBe(3500);
    });
  });
});
