"use client";

import { useEffect, useState } from "react";
import { buildCategoryTree, CategoryNode, StoreCategory } from "@/lib/categoryTree";

// One request shared by every component that shows categories (header and footer)
let categoriesRequest: Promise<StoreCategory[]> | null = null;

function loadCategories(): Promise<StoreCategory[]> {
  categoriesRequest ??= fetch("/api/categories")
    .then((res) => res.json())
    .then((json) => (json.ok ? (json.data as StoreCategory[]) : []))
    .catch((err) => {
      console.error("Error al cargar categorías:", err);
      categoriesRequest = null;
      return [];
    });

  return categoriesRequest;
}

/** Active categories as a tree (rubros with their categories), empty until loaded. */
export function useStoreCategories(): CategoryNode[] {
  const [tree, setTree] = useState<CategoryNode[]>([]);

  useEffect(() => {
    let isMounted = true;

    loadCategories().then((categories) => {
      if (isMounted) setTree(buildCategoryTree(categories));
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return tree;
}
