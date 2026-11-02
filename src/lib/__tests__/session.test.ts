import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { signAdminToken } from '@/lib/jwt';

let mongod: MongoMemoryServer;
let getSession: typeof import('@/lib/session').getSession;
let sessionError: typeof import('@/lib/session').sessionError;
let User: typeof import('@/models/User').default;

function reqWith(token?: string) {
  return new NextRequest('http://localhost/api/admin/auth/me', {
    headers: token ? { cookie: `admin_token=${token}` } : {},
  });
}

async function makeUser(over: Record<string, unknown> = {}) {
  return User.create({
    username: `u${Math.random().toString(36).slice(2, 8)}`,
    passwordHash: 'x',
    name: 'Nombre',
    role: 'admin',
    active: true,
    ...over,
  });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('session-test');
  ({ getSession, sessionError } = await import('@/lib/session'));
  User = (await import('@/models/User')).default;
  await (await import('@/lib/db')).connectToDatabase();
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('getSession', () => {
  it('returns the session for a valid token and active user', async () => {
    const u = await makeUser({ role: 'seller', username: 'vendedor' });
    const token = await signAdminToken({ id: String(u._id), username: 'vendedor', role: 'seller', name: 'Nombre' });
    expect(await getSession(reqWith(token))).toEqual({
      id: String(u._id),
      username: 'vendedor',
      name: 'Nombre',
      role: 'seller',
    });
  });

  it('returns null when the user is inactive', async () => {
    const u = await makeUser({ active: false });
    const token = await signAdminToken({ id: String(u._id), username: u.username, role: 'admin' });
    expect(await getSession(reqWith(token))).toBeNull();
  });

  it('uses the DB role, not the token role', async () => {
    const u = await makeUser({ role: 'seller' });
    const token = await signAdminToken({ id: String(u._id), username: u.username, role: 'admin' });
    expect((await getSession(reqWith(token)))?.role).toBe('seller');
  });

  it('returns null without cookie, with garbage token, missing id, bad id or deleted user', async () => {
    expect(await getSession(reqWith())).toBeNull();
    expect(await getSession(reqWith('garbage'))).toBeNull();
    expect(await getSession(reqWith(await signAdminToken({ username: 'x', role: 'admin' })))).toBeNull();
    expect(await getSession(reqWith(await signAdminToken({ id: 'nope', username: 'x', role: 'admin' })))).toBeNull();
    const ghost = new mongoose.Types.ObjectId().toString();
    expect(await getSession(reqWith(await signAdminToken({ id: ghost, username: 'x', role: 'admin' })))).toBeNull();
  });
});

describe('sessionError', () => {
  it.each([
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
  ] as const)('%i -> %s', async (status, error) => {
    const res = sessionError(status);
    expect(res.status).toBe(status);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe(error);
    expect(typeof body.message).toBe('string');
  });
});
