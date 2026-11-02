import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest, type NextResponse } from 'next/server';
import mongoose, { Types } from 'mongoose';
import { signAdminToken } from '@/lib/jwt';

/**
 * Every admin-only handler re-validates the session against the DB: the JWT
 * role alone is not enough. A deactivated user gets 401 and a user whose DB
 * role is no longer admin gets 403, even with a validly signed admin token.
 * Handlers are called directly (no middleware).
 */

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:1/unused';
// The ImageKit client is built at import time and rejects empty keys.
process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY ||= 'public_test';
process.env.IMAGEKIT_PRIVATE_KEY ||= 'private_test';
process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ||= 'https://ik.imagekit.io/test';

type Handler = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<NextResponse | Response>;

interface Case {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  load: () => Promise<Handler>;
  /** Write verbs get an invalid/empty body so nothing is created. */
  body?: unknown;
}

const anyId = String(new Types.ObjectId());
const h = (mod: Promise<Record<string, unknown>>, verb: string) => async () =>
  (await mod)[verb] as Handler;

const ROUTES: Case[] = [];
function add(path: string, load: () => Promise<Record<string, unknown>>, verbs: Case['method'][]) {
  for (const method of verbs) {
    ROUTES.push({
      name: `${method} ${path}`,
      method,
      url: path.replace('[id]', anyId),
      load: h(load(), method),
      body: method === 'POST' || method === 'PUT' ? {} : undefined,
    });
  }
}

add('/api/admin/users', () => import('../users/route'), ['GET', 'POST', 'PUT', 'DELETE']);
add('/api/admin/expenses', () => import('../expenses/route'), ['GET', 'POST', 'DELETE']);
add('/api/admin/settings', () => import('../settings/route'), ['GET', 'PUT']);
add('/api/admin/categories', () => import('../categories/route'), ['GET', 'POST']);
add('/api/admin/categories/[id]', () => import('../categories/[id]/route'), ['GET', 'PUT', 'DELETE']);
add('/api/admin/brands', () => import('../brands/route'), ['GET', 'POST', 'PUT', 'DELETE']);
add('/api/admin/attributes', () => import('../attributes/route'), ['GET', 'POST']);
add('/api/admin/attributes/[id]', () => import('../attributes/[id]/route'), ['GET', 'PUT', 'DELETE']);
add('/api/admin/promotions', () => import('../promotions/route'), ['GET', 'POST', 'PUT', 'DELETE']);
add('/api/admin/reports', () => import('../reports/route'), ['GET']);
add('/api/admin/imagekit/upload', () => import('../imagekit/upload/route'), ['POST']);
add('/api/admin/imagekit/delete', () => import('../imagekit/delete/route'), ['DELETE']);

let User: typeof import('@/models/User').default;

function request(c: Case, token?: string) {
  return new NextRequest(`http://localhost${c.url}`, {
    method: c.method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { cookie: `admin_token=${token}` } : {}),
    },
    ...(c.body !== undefined ? { body: JSON.stringify(c.body) } : {}),
  });
}

async function call(c: Case, token?: string) {
  const handler = await c.load();
  return handler(request(c, token), { params: Promise.resolve({ id: anyId }) });
}

/** A validly signed token; `dbRole`/`active` describe the stored user, `tokenRole` the claim. */
type Role = 'superadmin' | 'admin' | 'seller';
async function tokenFor(opts: { tokenRole: Role; dbRole: Role; active?: boolean }) {
  const user = await User.create({
    username: `u${Math.random().toString(36).slice(2, 10)}`,
    passwordHash: 'x',
    name: 'Usuario Prueba',
    role: opts.dbRole,
    active: opts.active ?? true,
  });
  return signAdminToken({ id: String(user._id), username: user.username, role: opts.tokenRole, name: user.name });
}

describe('admin-only routes re-validate the session (requireAdmin)', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    User = (await import('@/models/User')).default;
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri('admin-only-auth'));
    globalThis.mongooseCache!.conn = mongoose;
    globalThis.mongooseCache!.promise = Promise.resolve(mongoose);
    await User.init();
  }, 120000);

  afterAll(async () => {
    await mongoose.disconnect();
    globalThis.mongooseCache!.conn = null;
    globalThis.mongooseCache!.promise = null;
    await mongod.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(ROUTES)('$name: no cookie -> 401', async (c) => {
    const res = await call(c);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('UNAUTHORIZED');
  });

  it.each(ROUTES)('$name: admin token of a deactivated user -> 401', async (c) => {
    const token = await tokenFor({ tokenRole: 'admin', dbRole: 'admin', active: false });
    const res = await call(c, token);
    expect(res.status).toBe(401);
  });

  it.each(ROUTES)('$name: admin token whose DB user is now a seller -> 403', async (c) => {
    const token = await tokenFor({ tokenRole: 'admin', dbRole: 'seller' });
    const res = await call(c, token);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('FORBIDDEN');
  });

  it.each(ROUTES)('$name: a superadmin passes the auth check', async (c) => {
    const token = await tokenFor({ tokenRole: 'superadmin', dbRole: 'superadmin' });
    const res = await call(c, token);
    expect([401, 403]).not.toContain(res.status);
  });

  it.each(ROUTES.filter((c) => c.name !== 'DELETE /api/admin/users'))(
    '$name: an admin passes the auth check',
    async (c) => {
      const token = await tokenFor({ tokenRole: 'admin', dbRole: 'admin' });
      const res = await call(c, token);
      expect([401, 403]).not.toContain(res.status);
    }
  );

  it('DELETE /api/admin/users stays superadmin-only, judged by the DB role', async () => {
    const c = ROUTES.find((r) => r.name === 'DELETE /api/admin/users')!;
    const admin = await tokenFor({ tokenRole: 'admin', dbRole: 'admin' });
    const res = await call(c, admin);
    expect(res.status).toBe(403);
    expect((await res.json()).message).toBe('Solo un Superadmin puede eliminar usuarios definitivamente');

    // A superadmin claim in the token does not help once the DB role is admin.
    const demoted = await tokenFor({ tokenRole: 'superadmin', dbRole: 'admin' });
    expect((await call(c, demoted)).status).toBe(403);
  });

  it('POST /api/admin/users: a demoted superadmin cannot create a superadmin', async () => {
    const demoted = await tokenFor({ tokenRole: 'superadmin', dbRole: 'admin' });
    const c: Case = {
      name: 'POST /api/admin/users',
      method: 'POST',
      url: '/api/admin/users',
      load: async () => (await import('../users/route')).POST as Handler,
      body: { username: 'nuevo_super', password: 'secreto123', name: 'Nuevo', role: 'superadmin' },
    };
    const res = await call(c, demoted);
    expect(res.status).toBe(403);
    expect(await User.countDocuments({ username: 'nuevo_super' })).toBe(0);
  });

  it('GET /api/admin/users still lists users for an admin', async () => {
    const token = await tokenFor({ tokenRole: 'admin', dbRole: 'admin' });
    const c = ROUTES.find((r) => r.name === 'GET /api/admin/users')!;
    const res = await call(c, token);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).not.toHaveProperty('passwordHash');
  });
});
