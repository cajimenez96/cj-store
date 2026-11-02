/** Total quantity at which wholesale pricing applies (mirrors create-direct). */
export const WHOLESALE_THRESHOLD = 5;

export interface ListPrices {
  retail: number;
  wholesale?: number;
}

/**
 * Resolves the catalog list price: wholesale when the total quantity reaches
 * WHOLESALE_THRESHOLD and a positive wholesale price exists, otherwise retail.
 */
export function resolveListPrice(
  prices: ListPrices,
  totalQty: number
): { price: number; type: 'retail' | 'wholesale' } {
  const wholesale = Number(prices.wholesale ?? 0);
  if (totalQty >= WHOLESALE_THRESHOLD && wholesale > 0) {
    return { price: wholesale, type: 'wholesale' };
  }
  return { price: prices.retail, type: 'retail' };
}
