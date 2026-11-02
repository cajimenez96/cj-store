import { describe, it, expect } from 'vitest';
import { canAccess, isAdminRole, SELLER_ACCESS_ENABLED } from '@/lib/permissions';

// Uses the real default flag: these tests assert the shipped seller policy.
const seller = (method: string, path: string) => canAccess('seller', method, path);
const off = { sellerAccessEnabled: false };

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

  it('enables seller access by default', () => {
    expect(SELLER_ACCESS_ENABLED).toBe(true);
    expect(canAccess('seller', 'GET', '/api/admin/orders')).toBe(true);
    expect(canAccess('seller', 'POST', '/api/admin/sales/create-direct')).toBe(true);
    expect(canAccess('seller', 'GET', '/api/admin/accounting')).toBe(true);
    expect(canAccess('seller', 'GET', '/api/admin/stock')).toBe(true);
    expect(canAccess('seller', 'PUT', '/api/admin/stock')).toBe(false);
    expect(canAccess('seller', 'GET', '/api/admin/users')).toBe(false);
    expect(canAccess('seller', 'POST', '/api/admin/orders/abc123/authorize')).toBe(false);
  });

  it('kill switch: with the flag override off every seller request is denied', () => {
    for (const [method, path] of [
      ['GET', '/api/admin/orders'],
      ['POST', '/api/admin/sales/create-direct'],
      ['GET', '/api/admin/accounting'],
      ['GET', '/api/admin/stock'],
      ['GET', '/api/admin/auth/me'],
      ['GET', '/admin/pos'],
      ['GET', '/admin/orders'],
    ]) {
      expect(canAccess('seller', method, path, off)).toBe(false);
    }
    // Admin access is unaffected by the switch.
    expect(canAccess('admin', 'GET', '/api/admin/users', off)).toBe(true);
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

describe('canAccess hardening', () => {
  it('handles trailing slashes, lowercase methods and sub-pages', () => {
    expect(seller('GET', '/api/admin/orders/')).toBe(true);
    expect(seller('GET', '/api/admin/orders/abc123/')).toBe(true);
    expect(seller('get', '/api/admin/orders')).toBe(true);
    expect(seller('GET', '/admin/orders/abc123')).toBe(true);
    expect(seller('DELETE', '/api/admin/orders/abc123')).toBe(false);
  });

  it.each([
    ['GET', '/admin/orders/../users'],
    ['GET', '/admin/orders/../../api/admin/users'],
    ['PUT', '/api/admin/orders/..'],
    ['PUT', '/api/admin/orders/../'],
    ['PUT', '/api/admin/orders/%2e%2e'],
    ['PUT', '/api/admin/orders/%2E%2E'],
    ['PUT', '/api/admin/orders/.'],
    ['GET', '/admin/orders/./x'],
    ['GET', '/api/admin/orders/a\nb'],
    ['GET', '/api/admin/orders/%00'],
    ['GET', '/api/admin/orders/a\u0000b'],
    ['GET', '/api/admin/orders//abc'],
    ['GET', '/api/admin/orders/%ZZ'],
  ])('denies seller traversal/control input %s %s', (method, path) => {
    expect(seller(method, path)).toBe(false);
  });

  it.each([
    '/admin/orders-evil',
    '/admin/ordersX',
    '/api/admin/orders-export',
    '/api/admin/stockx',
  ])('denies near-miss prefix %s', (path) => {
    expect(seller('GET', path)).toBe(false);
  });

  it.each([undefined, '', 'Seller', 'user'])('denies invalid role %j', (role) => {
    expect(canAccess(role as never, 'GET', '/api/admin/orders')).toBe(false);
  });

  it('leaves admin and superadmin unchanged for traversal-looking paths', () => {
    for (const role of ['admin', 'superadmin'] as const) {
      expect(canAccess(role, 'GET', '/admin/orders/../users')).toBe(true);
      expect(canAccess(role, 'PUT', '/api/admin/orders/%2e%2e')).toBe(true);
    }
  });
});
