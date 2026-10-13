export interface BrandOption {
  _id: string;
  name: string;
}

export interface BrandGroup {
  letter: string;
  brands: BrandOption[];
}

/** Lowercase, accent-free text, so "Ámbar" sorts and matches next to "Ambar". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Filters brands by name (accent and case insensitive) and groups them alphabetically.
 * Brands that do not start with a letter, such as "212", go under "#", which comes first.
 * The input array is not mutated.
 */
export function groupBrandsByLetter(brands: BrandOption[], query = ''): BrandGroup[] {
  const needle = normalize(query);

  const sorted = brands
    .filter((brand) => !needle || normalize(brand.name).includes(needle))
    .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name), 'es', { numeric: true }));

  const groups = new Map<string, BrandOption[]>();
  for (const brand of sorted) {
    const first = normalize(brand.name).charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : '#';
    groups.set(letter, [...(groups.get(letter) ?? []), brand]);
  }

  return Array.from(groups, ([letter, items]) => ({ letter, brands: items })).sort((a, b) => {
    if (a.letter === '#') return -1;
    if (b.letter === '#') return 1;
    return a.letter.localeCompare(b.letter);
  });
}
