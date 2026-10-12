export interface OptionSelection {
  key: string;
  value: string;
}

export interface GeneratedVariantSkeleton {
  sku: string;
  options: OptionSelection[];
  retailPrice: number;
  wholesalePrice?: number;
  stock: number;
  active: boolean;
}

/**
 * Generates all Cartesian combinations from a list of axes and selected option values.
 * Example:
 * axes: [
 *   { key: "color", values: ["negro", "blanco"] },
 *   { key: "talle", values: ["s", "m"] }
 * ]
 * Output: 4 combinations
 */
export function generateVariantCombinations(
  axes: { key: string; values: string[] }[],
  productSlug: string = '',
  defaultRetailPrice: number = 0,
  defaultWholesalePrice?: number
): GeneratedVariantSkeleton[] {
  if (axes.length === 0) {
    // Simple product without axes: single default variant
    return [
      {
        sku: generateSku(productSlug, []),
        options: [],
        retailPrice: defaultRetailPrice,
        wholesalePrice: defaultWholesalePrice,
        stock: 0,
        active: true,
      },
    ];
  }

  function cartesian(arr: { key: string; value: string }[][]): { key: string; value: string }[][] {
    return arr.reduce(
      (a, b) => a.flatMap((d) => b.map((e) => [...d, e])),
      [[]] as { key: string; value: string }[][]
    );
  }

  const axisOptionsList = axes.map((axis) =>
    axis.values.map((val) => ({
      key: axis.key,
      value: val,
    }))
  );

  const rawCombinations = cartesian(axisOptionsList);

  return rawCombinations.map((combo) => ({
    sku: generateSku(productSlug, combo),
    options: combo,
    retailPrice: defaultRetailPrice,
    wholesalePrice: defaultWholesalePrice,
    stock: 0,
    active: true,
  }));
}

/**
 * Generates an uppercase SKU based on product slug and option values.
 * e.g. ("remera-basica", [{ key: "color", value: "negro" }, { key: "talle", value: "m" }]) -> "REM-NEG-M"
 */
export function generateSku(productSlug: string, options: OptionSelection[]): string {
  const cleanSlug = (productSlug || 'PROD')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .slice(0, 8);

  if (options.length === 0) {
    return `${cleanSlug}-01`;
  }

  const optionParts = options
    .map((o) =>
      o.value
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 4)
    )
    .filter(Boolean)
    .join('-');

  return `${cleanSlug}-${optionParts}`;
}

/**
 * Formats a human-readable variant label given its options and labels dictionary.
 * e.g. ("Negro / Talle M")
 */
export function formatVariantLabel(
  options: OptionSelection[],
  labelsMap?: Record<string, string>
): string {
  if (!options || options.length === 0) return '';

  return options
    .map((o) => {
      const displayLabel = labelsMap?.[`${o.key}:${o.value}`] || labelsMap?.[o.value] || o.value;
      return displayLabel;
    })
    .join(' / ');
}
