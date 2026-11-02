import { describe, it, expect } from 'vitest';
import { canAccess, isAdminRole, SELLER_ACCESS_ENABLED } from '@/lib/permissions';

const on = { sellerAccessEnabled: true };
const seller = (method: string, path: string) => canAccess('seller', method, path, on);

describe('isAdminRole', () => {
  it('accepts admin and superadmin only', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('superadmin')).toBe(true);
    expect(isAdminRole('seller')).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe('canAccess', () => {
  it('allows admin and superadmin everywhere', () => {
    for (const role of ['admin', 'superadmin'] as const) {
      expect(canAccess(role, 'DELETE', '/api/admin/users/1')).toBe(true);
      expect(canAccess(role, 'GET', '/admin/settings')).toBe(true);
    }
  });

  it('denies sellers everywhere with the default flag', () => {
    expect(SELLER_ACCESS_ENABLED).toBe(false);
    expect(canAccess('seller', 'GET', '/api/admin/orders')).toBe(false);
    expect(canAccess('seller', 'GET', '/admin/pos')).toBe(false);
    expect(canAccess('seller', 'GET', '/api/admin/auth/me')).toBe(false);
  });

  it.each([
    ['GET', '/api/admin/orders'],
    ['POST', '/api/admin/sales/create-direct'],
    ['GET', '/api/admin/accounting'],
    ['GET', '/api/admin/stock'],
    ['GET', '/api/admin/products'],
    ['GET', '/api/admin/orders/abc123'],
    ['PUT', '/api/admin/orders/abc123'],
    ['PATCH', '/api/admin/orders/abc123'],
    ['GET', '/api/admin/auth/me'],
    ['GET', '/admin/orders'],
    ['GET', '/admin/pos'],
    ['GET', '/admin/accounting'],
    ['GET', '/admin/stock'],
  ])('allows seller %s %s', (method, path) => {
    expect(seller(method, path)).toBe(true);
  });

  it.each([
    ['PUT', '/api/admin/stock'],
    ['PATCH', '/api/admin/products/abc/stock'],
    ['PUT', '/api/admin/orders'],
    ['POST', '/api/admin/orders/abc/authorize'],
    ['GET', '/api/admin/users'],
    ['GET', '/admin/users'],
    ['GET', '/admin/settings'],
    ['POST', '/api/admin/products'],
  ])('denies seller %s %s', (method, path) => {
    expect(seller(method, path)).toBe(false);
  });
});
