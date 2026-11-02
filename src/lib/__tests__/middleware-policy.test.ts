import { describe, it, expect } from 'vitest';
import { deniedPageRedirect } from '@/lib/permissions';
import { verifySessionToken, signAdminToken } from '@/lib/jwt';

describe('deniedPageRedirect', () => {
  it('sends a seller denied elsewhere to /admin/orders with the default flag', () => {
    expect(deniedPageRedirect('seller', '/admin/users')).toBe('/admin/orders');
  });
  it('sends sellers to login when the kill switch is off, to avoid a loop', () => {
    const off = { sellerAccessEnabled: false };
    expect(deniedPageRedirect('seller', '/admin/users', off)).toBe('/admin/login');
    expect(deniedPageRedirect('seller', '/admin/orders', off)).toBe('/admin/login');
  });
  it('never targets the current path', () => {
    expect(deniedPageRedirect('seller', '/admin/orders')).toBe('/admin/login');
  });
});

describe('verifySessionToken', () => {
  it('accepts all three roles and rejects others', async () => {
    for (const role of ['superadmin', 'admin', 'seller']) {
      const t = await signAdminToken({ id: 'i', username: 'u', role, name: 'n' });
      expect(await verifySessionToken(t)).toMatchObject({ role, user: 'u', id: 'i' });
    }
    expect(await verifySessionToken(await signAdminToken({ username: 'u', role: 'hacker' }))).toBeNull();
    expect(await verifySessionToken('bad')).toBeNull();
  });
});
