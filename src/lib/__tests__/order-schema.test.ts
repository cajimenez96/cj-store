import { describe, it, expect } from 'vitest';
import Order from '@/models/Order';
import SalesRecord from '@/models/SalesRecord';

describe('Order schema (legacy compatibility)', () => {
  it('validates a legacy order without soldBy/listPrice/history and defaults history to []', () => {
    const doc = new Order({
      orderNumber: 'ORD-1',
      guest: { name: 'A', lastName: 'B', phone: '1' },
      items: [{ productId: '507f1f77bcf86cd799439011', name: 'X', qty: 1, unitPrice: 10, subtotal: 10 }],
      subtotal: 10,
      total: 10,
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.history).toHaveLength(0);
    expect(doc.soldBy).toBeUndefined();
  });
  it('accepts soldBy on SalesRecord and Order', () => {
    const soldBy = { userId: '507f1f77bcf86cd799439011', username: 'ana', name: 'Ana' };
    const rec = new SalesRecord({
      orderId: '507f1f77bcf86cd799439012', orderNumber: 'ORD-1', recordedPaymentMethod: 'efectivo', finalTotal: 10, soldBy,
    });
    expect(rec.validateSync()).toBeUndefined();
    expect(rec.soldBy?.username).toBe('ana');
    const order = new Order({
      orderNumber: 'ORD-2',
      guest: { name: 'A', lastName: 'B', phone: '1' },
      items: [{ productId: '507f1f77bcf86cd799439011', name: 'X', qty: 1, unitPrice: 10, subtotal: 10 }],
      subtotal: 10,
      total: 10,
      soldBy,
    });
    expect(order.validateSync()).toBeUndefined();
    expect(order.soldBy?.username).toBe('ana');
    const hasIndex = Order.schema.indexes().some(([f]) => 'soldBy.userId' in f);
    expect(hasIndex).toBe(true);
  });
});
