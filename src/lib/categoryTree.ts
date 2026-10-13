export interface StoreCategory {
  _id: string;
  name: string;
  slug: string;
  parentId?: string | null;
}

export interface CategoryNode extends StoreCategory {
  children: CategoryNode[];
}

/**
 * Builds the category tree from the flat list of active categories: roots are the store's
 * "rubros" and their children the categories inside them. The input order is kept, so sorting
 * stays whatever the API returned. A category whose parent is missing from the list (for
 * example an inactive parent) is treated as a root so it stays reachable.
 */
export function buildCategoryTree(categories: StoreCategory[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(
    categories.map((category) => [category._id, { ...category, children: [] }])
  );

  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(String(node.parentId)) : undefined;
    (parent ? parent.children : roots).push(node);
  }

  return roots;
}

/** Storefront link that opens the catalog filtered by a category and its descendants. */
export function categoryHref(category: Pick<StoreCategory, '_id'>): string {
  return `/?categoryId=${category._id}#catalogo`;
}
