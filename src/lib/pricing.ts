export type PricingProduct = {
  id: string;
  wholesale: {
    enabled: boolean;
    minQty?: number;
  };
  variants: {
    id: string;
    retailPrice: number;
    wholesalePrice?: number;
  }[];
};

export type CartLine = {
  productId: string;
  variantId: string;
  qty: number;
};

export type PricedCartItem = CartLine & {
  unitPrice: number;
  appliedPriceType: 'retail' | 'wholesale';
  subtotal: number;
  wholesaleMissing: number;
};

export type CartPriceSummary = {
  items: PricedCartItem[];
  subtotal: number;
  discount: number;
  total: number;
};

export class PricingError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, details?: unknown, message?: string) {
    super(message || `Error en cálculo de precios: ${code}`);
    this.name = 'PricingError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Pure function to calculate shopping cart pricing, wholesale discounts and subtotals.
 * Shared between client CartContext and server checkout validation.
 */
export function priceCart(
  lines: CartLine[],
  products: Map<string, PricingProduct>
): CartPriceSummary {
  const unitsByProduct = new Map<string, number>();

  for (const l of lines) {
    unitsByProduct.set(l.productId, (unitsByProduct.get(l.productId) ?? 0) + l.qty);
  }

  const items: PricedCartItem[] = lines.map((l) => {
    const p = products.get(l.productId);
    const v = p?.variants.find((x) => x.id === l.variantId);

    if (!p || !v) {
      throw new PricingError('VARIANT_NOT_FOUND', l, `Variante o producto no encontrado para el ítem`);
    }

    const units = unitsByProduct.get(l.productId) || 0;
    const minQty = p.wholesale.minQty ?? Infinity;
    const isWholesale =
      Boolean(p.wholesale.enabled) &&
      v.wholesalePrice != null &&
      v.wholesalePrice > 0 &&
      units >= minQty;

    const unitPrice = isWholesale ? v.wholesalePrice! : v.retailPrice;

    return {
      ...l,
      unitPrice,
      appliedPriceType: isWholesale ? ('wholesale' as const) : ('retail' as const),
      subtotal: unitPrice * l.qty,
      wholesaleMissing: p.wholesale.enabled && !isWholesale ? Math.max(0, minQty - units) : 0,
    };
  });

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);

  return {
    items,
    subtotal,
    discount: 0,
    total: subtotal,
  };
}
