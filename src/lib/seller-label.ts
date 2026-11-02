// Pure, client-safe helpers for "who sold this order" (no Mongoose imports).

/** Filter/row key for direct (POS) sales made before sales were attributed to a user. */
export const LEGACY_SELLER_KEY = 'legacy';
export const LEGACY_SELLER_NAME = 'Admin (sin registro)';
export const WEB_SELLER_KEY = 'web';
export const WEB_SELLER_NAME = 'Web';

interface SellerSource {
  origin?: string;
  soldBy?: { userId?: unknown; name?: string } | null;
}

/** Stable grouping key: the seller's user id, `'web'` for web orders, `'legacy'` otherwise. */
export function sellerKey(order: SellerSource): string {
  if (order.soldBy?.userId) return String(order.soldBy.userId);
  return order.origin === 'web' ? WEB_SELLER_KEY : LEGACY_SELLER_KEY;
}

/** Display label: the seller's name, `'Web'` for web orders, `'Admin (sin registro)'` otherwise. */
export function sellerLabel(order: SellerSource): string {
  if (order.soldBy?.name) return order.soldBy.name;
  return order.origin === 'web' ? WEB_SELLER_NAME : LEGACY_SELLER_NAME;
}
