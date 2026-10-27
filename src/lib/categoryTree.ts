export interface StoreCategory {
  _id: string;
  name: string;
  slug: string;
  parentId?: string | null;
}

/** A category plus its children; extra fields of the source objects (counts, specs, ...) are kept. */
export type CategoryTreeNode<T extends StoreCategory = StoreCategory> = T & {
  children: CategoryTreeNode<T>[];
};

export type CategoryNode = CategoryTreeNode;

/**
 * Builds the category tree from the flat list of active categories: roots are the store's
 * "rubros" and their children the categories inside them. The input order is kept, so sorting
 * stays whatever the API returned. A category whose parent is missing from the list (for
 * example an inactive parent) is treated as a root so it stays reachable.
 */
export function buildCategoryTree<T extends StoreCategory>(categories: T[]): CategoryTreeNode<T>[] {
  const nodes = new Map<string, CategoryTreeNode<T>>(
    categories.map((category) => [category._id, { ...category, children: [] } as CategoryTreeNode<T>])
  );

  const roots: CategoryTreeNode<T>[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(String(node.parentId)) : undefined;
    (parent ? parent.children : roots).push(node);
  }

  return roots;
}

export interface CategoryOption {
  _id: string;
  name: string;
}

/** Depth-first list labelled "Parent › Child", so each rubro is followed by its own categories. */
export function flattenCategoryLabels(nodes: CategoryNode[], parents: string[] = []): CategoryOption[] {
  return nodes.flatMap((node) => {
    const path = [...parents, node.name];
    return [{ _id: node._id, name: path.join(' › ') }, ...flattenCategoryLabels(node.children, path)];
  });
}

/** Storefront link that opens the catalog filtered by a category and its descendants. */
export function categoryHref(category: Pick<StoreCategory, '_id'>): string {
  return `/?categoryId=${category._id}#catalogo`;
}
