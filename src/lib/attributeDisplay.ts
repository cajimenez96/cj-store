import Attribute from '@/models/Attribute';

interface AttributeLean {
  key: string;
  unit?: string;
  options: { value: string; label: string }[];
}

interface DisplayOption {
  key: string;
  value: string;
  label?: string;
  unit?: string;
}

interface OptionDisplayTarget {
  variants?: { options?: DisplayOption[] }[];
  specs?: DisplayOption[];
}

/**
 * Adds the visible label and unit to variant options and product specs, so the storefront can show
 * "60ml" instead of the stored slug "60". Mutates the lean product documents it receives.
 */
export async function attachOptionDisplay<T extends OptionDisplayTarget>(products: T[]): Promise<void> {
  const keys = new Set<string>();
  for (const product of products) {
    for (const variant of product.variants ?? []) {
      for (const option of variant.options ?? []) keys.add(option.key);
    }
    for (const spec of product.specs ?? []) keys.add(spec.key);
  }
  if (keys.size === 0) return;

  const attributes = (await Attribute.find({ key: { $in: Array.from(keys) } }).lean()) as AttributeLean[];
  const attributeByKey = new Map(attributes.map((attribute) => [attribute.key, attribute]));

  const enrich = (item: DisplayOption) => {
    const attribute = attributeByKey.get(item.key);
    if (!attribute) return;
    const match = attribute.options.find((o) => o.value === item.value);
    if (match) item.label = match.label;
    item.unit = attribute.unit || undefined;
  };

  for (const product of products) {
    for (const variant of product.variants ?? []) {
      for (const option of variant.options ?? []) enrich(option);
    }
    for (const spec of product.specs ?? []) enrich(spec);
  }
}
