import { describe, it, expect } from 'vitest';
import { createdEntry, diffOrder, type OrderSnapshot } from '../order-history';

const actor = { id: 'u1', name: 'Ana' };
const base = (): OrderSnapshot => ({
  items: [
    { variantId: 'v1', productId: 'p1', name: 'Zapato', variantLabel: '40', qty: 2, unitPrice: 15000 },
    { variantId: 'v2', productId: 'p1', name: 'Bota', qty: 1, unitPrice: 20000 },
  ],
  discount: 0,
  paymentMethod: 'efectivo',
  status: 'pendiente',
});

describe('createdEntry', () => {
  it('builds a created entry', () => {
    const e = createdEntry(actor, 30000);
    expect(e.action).toBe('created');
    expect(e.byName).toBe('Ana');
    expect(e.byUserId).toBe('u1');
    expect(e.summary).toBe('Pedido creado (total $30.000,00)');
    expect(e.summary).not.toContain('creado por');
    expect(e.at).toBeInstanceOf(Date);
  });
});

describe('diffOrder', () => {
  it('returns [] for identical snapshots', () => {
    expect(diffOrder(base(), base(), actor)).toEqual([]);
  });
  it('price change', () => {
    const a = base();
    a.items[0].unitPrice = 12000;
    const r = diffOrder(base(), a, actor);
    expect(r).toHaveLength(1);
    expect(r[0].action).toBe('price_changed');
    expect(r[0].summary).toContain('15000 → 12000');
    expect(r[0].summary).toContain('Zapato');
  });
  it('quantity change', () => {
    const a = base();
    a.items[0].qty = 3;
    const r = diffOrder(base(), a, actor);
    expect(r.map((e) => e.action)).toEqual(['quantity_changed']);
    expect(r[0].summary).toContain('2 → 3');
  });
  it('item removed and added', () => {
    const a = base();
    a.items.splice(1, 1);
    a.items.push({ variantId: 'v3', productId: 'p2', name: 'Sandalia', qty: 1, unitPrice: 5000 });
    const r = diffOrder(base(), a, actor);
    expect(r.map((e) => e.action).sort()).toEqual(['item_added', 'item_removed']);
  });
  it('discount change', () => {
    const a = base();
    a.discount = 500;
    const r = diffOrder(base(), a, actor);
    expect(r.map((e) => e.action)).toEqual(['discount_changed']);
    expect(r[0].summary).toContain('0 → 500');
  });
  it('payment change', () => {
    const a = base();
    a.paymentMethod = 'tarjeta';
    const r = diffOrder(base(), a, actor);
    expect(r.map((e) => e.action)).toEqual(['payment_changed']);
    expect(r[0].summary).toContain('efectivo → tarjeta');
  });
  it('status change', () => {
    const a = base();
    a.status = 'autorizado';
    const r = diffOrder(base(), a, actor);
    expect(r.map((e) => e.action)).toEqual(['status_changed']);
  });
  it.each(['cancelled', 'cancelado', 'cancelada'])('cancellation (%s) emits only cancelled with reason', (s) => {
    const a = base();
    a.status = s;
    const r = diffOrder(base(), a, actor, 'Cliente desistió');
    expect(r.map((e) => e.action)).toEqual(['cancelled']);
    expect(r[0].summary).toContain('Cliente desistió');
  });
  it('matches by sku/name when variantId missing', () => {
    const b = base();
    delete b.items[1].variantId;
    b.items[1].sku = 'BOT';
    const a = JSON.parse(JSON.stringify(b)) as OrderSnapshot;
    expect(diffOrder(b, a, actor)).toEqual([]);
  });

  const it1 = (v: string, qty: number, unitPrice = 100) => ({ variantId: v, productId: 'p', name: 'A', qty, unitPrice });
  const snap = (items: OrderSnapshot['items'], extra: Partial<OrderSnapshot> = {}): OrderSnapshot => ({
    items, discount: 0, paymentMethod: 'efectivo', status: 'pendiente', ...extra,
  });

  it('pairs duplicate keys by occurrence: [A2,A2] -> [A2,A5]', () => {
    const r = diffOrder(snap([it1('a', 2), it1('a', 2)]), snap([it1('a', 2), it1('a', 5)]), actor);
    expect(r.map((e) => e.action)).toEqual(['quantity_changed']);
    expect(r[0].summary).toContain('2 → 5');
  });
  it('duplicate removed: [A2,A3] -> [A2]', () => {
    const r = diffOrder(snap([it1('a', 2), it1('a', 3)]), snap([it1('a', 2)]), actor);
    expect(r.map((e) => e.action)).toEqual(['item_removed']);
  });
  it('duplicate added: [A2] -> [A2,A3]', () => {
    const r = diffOrder(snap([it1('a', 2)]), snap([it1('a', 2), it1('a', 3)]), actor);
    expect(r.map((e) => e.action)).toEqual(['item_added']);
  });
  it('reordered items produce no entries', () => {
    expect(diffOrder(snap([it1('a', 1), it1('b', 2)]), snap([it1('b', 2), it1('a', 1)]), actor)).toEqual([]);
  });
  it('qty and price change on same item emit both', () => {
    const r = diffOrder(snap([it1('a', 1, 100)]), snap([it1('a', 2, 90)]), actor);
    expect(r.map((e) => e.action).sort()).toEqual(['price_changed', 'quantity_changed']);
  });
  it('discount undefined <-> 0 is a no-op', () => {
    const u = snap([it1('a', 1)], { discount: undefined as unknown as number });
    expect(diffOrder(u, snap([it1('a', 1)]), actor)).toEqual([]);
    expect(diffOrder(snap([it1('a', 1)]), u, actor)).toEqual([]);
  });
  it('NaN equals NaN', () => {
    const n = () => snap([it1('a', NaN, NaN)], { discount: NaN });
    expect(diffOrder(n(), n(), actor)).toEqual([]);
  });
  it('createdEntry with NaN total has no "NaN"', () => {
    expect(createdEntry(actor, NaN).summary).not.toContain('NaN');
  });
  it('cancelado -> cancelada is a no-op', () => {
    expect(diffOrder(snap([], { status: 'cancelado' }), snap([], { status: 'cancelada' }), actor)).toEqual([]);
  });
  it('cancelled -> non-cancelled emits status_changed', () => {
    const r = diffOrder(snap([], { status: 'cancelado' }), snap([], { status: 'pendiente' }), actor);
    expect(r.map((e) => e.action)).toEqual(['status_changed']);
  });
  it('undefined items do not throw', () => {
    const u = { discount: 0, paymentMethod: 'efectivo', status: 'pendiente' } as unknown as OrderSnapshot;
    expect(diffOrder(u, u, actor)).toEqual([]);
    expect(diffOrder(u, snap([it1('a', 1)]), actor).map((e) => e.action)).toEqual(['item_added']);
  });
});
