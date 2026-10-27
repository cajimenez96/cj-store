export interface StockEntry {
  /** Stable React key: the variant id, or `variant-<index>` if it has none */
  key: string;
  variantId?: string;
  label: string;
  sku?: string;
  stock: number;
  active: boolean;
}

interface StockSourceVariant {
  _id?: { toString(): string } | string;
  sku?: string;
  name?: string;
  options?: { key: string; value: string }[];
  stock?: number;
  active?: boolean;
}

export interface StockSource {
  variants?: StockSourceVariant[];
}

function variantLabel(variant: StockSourceVariant): string {
  if (variant.options && variant.options.length > 0) {
    return variant.options.map((o) => o.value).join(' / ');
  }
  return variant.name || variant.sku || 'Única';
}

/** Flattens a product's variants into editable stock rows. */
export function buildStockEntries(product: StockSource): StockEntry[] {
  return (product.variants ?? []).map((variant, index) => {
    const id = variant._id ? variant._id.toString() : undefined;
    return {
      key: id ?? `variant-${index}`,
      variantId: id,
      label: variantLabel(variant),
      sku: variant.sku,
      stock: Math.max(0, Number(variant.stock) || 0),
      active: variant.active !== false,
    };
  });
}

/** Total units across active rows; inactive variants do not count, like in `derived.ts`. */
export function sumActiveStock(entries: StockEntry[]): number {
  return entries.reduce((acc, entry) => (entry.active ? acc + entry.stock : acc), 0);
}
