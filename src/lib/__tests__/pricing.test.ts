import { describe, it, expect } from 'vitest';
import { resolveListPrice, WHOLESALE_THRESHOLD } from '../pricing';

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
