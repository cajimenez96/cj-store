import { describe, it, expect } from 'vitest';
import { resolveListPrice, WHOLESALE_THRESHOLD, priceCart, PricingError } from '../pricing';

describe('resolveListPrice', () => {
  it('exports threshold 5', () => expect(WHOLESALE_THRESHOLD).toBe(5));
  it('retail below threshold', () => {
    expect(resolveListPrice({ retail: 100, wholesale: 80 }, 4)).toEqual({ price: 100, type: 'retail' });
  });
  it('wholesale at threshold', () => {
    expect(resolveListPrice({ retail: 100, wholesale: 80 }, 5)).toEqual({ price: 80, type: 'wholesale' });
  });
  it('retail when no wholesale price', () => {
    expect(resolveListPrice({ retail: 100 }, 10)).toEqual({ price: 100, type: 'retail' });
    expect(resolveListPrice({ retail: 100, wholesale: 0 }, 10)).toEqual({ price: 100, type: 'retail' });
  });
});

describe('resolveListPrice edge cases', () => {
  it('retail 0 stays 0 below threshold', () => {
    expect(resolveListPrice({ retail: 0 }, 1)).toEqual({ price: 0, type: 'retail' });
  });
  it('variant-only price (no wholesale) at high qty uses retail', () => {
    expect(resolveListPrice({ retail: 50 }, 6)).toEqual({ price: 50, type: 'retail' });
  });
});

describe('priceCart (legacy engine still exported)', () => {
  const products = new Map([
    ['p1', { id: 'p1', wholesale: { enabled: true, minQty: 3 }, variants: [{ id: 'v1', retailPrice: 100, wholesalePrice: 80 }] }],
  ]);
  it('prices a retail cart', () => {
    const r = priceCart([{ productId: 'p1', variantId: 'v1', qty: 2 }], products);
    expect(r.total).toBe(200);
    expect(r.items[0].appliedPriceType).toBe('retail');
    expect(r.items[0].wholesaleMissing).toBe(1);
  });
  it('prices wholesale and throws PricingError on unknown variant', () => {
    expect(priceCart([{ productId: 'p1', variantId: 'v1', qty: 3 }], products).total).toBe(240);
    expect(() => priceCart([{ productId: 'p1', variantId: 'x', qty: 1 }], products)).toThrow(PricingError);
  });
});
