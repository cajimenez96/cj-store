export interface VariantDerivedInput {
  retailPrice: number;
  wholesalePrice?: number;
  stock: number;
  active: boolean;
}

export interface ProductDerivedFields {
  priceRange: {
    min: number;
    max: number;
  };
  totalStock: number;
  hasWholesale: boolean;
}

/**
 * Calculates derived fields from active variants.
 * Guarantees that store catalog queries do not need to unwind arrays for filtering or badges.
 */
export function calculateDerivedProductFields(
  variants: VariantDerivedInput[],
  wholesaleEnabled: boolean = false
): ProductDerivedFields {
  const activeVariants = variants.filter((v) => v.active !== false);

  if (activeVariants.length === 0) {
    return {
      priceRange: { min: 0, max: 0 },
      totalStock: 0,
      hasWholesale: false,
    };
  }

  const prices = activeVariants.map((v) => Number(v.retailPrice) || 0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const totalStock = activeVariants.reduce(
    (acc, curr) => acc + (Math.max(0, Number(curr.stock)) || 0),
    0
  );

  const hasWholesale =
    Boolean(wholesaleEnabled) &&
    activeVariants.some(
      (v) => v.wholesalePrice != null && Number(v.wholesalePrice) > 0
    );

  return {
    priceRange: {
      min: minPrice,
      max: maxPrice,
    },
    totalStock,
    hasWholesale,
  };
}
