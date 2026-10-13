'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { FormattedProduct } from '@/components/products';

const WHOLESALE_THRESHOLD = 5;

export interface CartItem {
  productId: string;
  variantId?: string;
  sku?: string;
  name: string;
  retailPrice: number;
  wholesalePrice: number;
  variantLabel?: string;
  variantName?: string;
  /** @deprecated Legacy shoe size */
  size?: number;
  qty: number;
  image: string;
  maxStock: number;
  wholesaleMinUnits?: number;
}

export type VariantParam =
  | {
      variantId?: string;
      variantLabel?: string;
      variantName?: string;
      sku?: string;
      retailPrice?: number;
      wholesalePrice?: number;
      size?: number;
      maxStock?: number;
    }
  | number
  | string
  | undefined;

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  totalItems: number;
  totalPairs: number;
  totalUnits: number;
  isWholesale: boolean;
  subtotal: number;
  addToCart: (product: FormattedProduct, variant: VariantParam, qty: number) => void;
  removeFromCart: (productId: string, variant?: VariantParam) => void;
  updateQuantity: (productId: string, variant: VariantParam, qty: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  getEffectivePrice: (item: CartItem) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'fp_zapatillas_cart_v2';

function matchVariant(item: CartItem, variant?: VariantParam): boolean {
  if (variant === undefined || variant === null) {
    return !item.variantId && !item.variantName && !item.size;
  }
  if (typeof variant === 'number') {
    return item.size === variant;
  }
  if (typeof variant === 'string') {
    return item.variantId === variant || item.variantName === variant || String(item.size) === variant;
  }
  if (variant.variantId && item.variantId) {
    return item.variantId === variant.variantId;
  }
  if (variant.variantName && item.variantName) {
    return item.variantName === variant.variantName;
  }
  if (variant.size !== undefined && item.size !== undefined) {
    return item.size === variant.size;
  }
  return !item.variantId && !item.variantName && !item.size;
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load cart from localStorage on initial render
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Error al cargar carrito desde localStorage:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save cart to localStorage on changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Error al guardar carrito en localStorage:', err);
    }
  }, [items, isLoaded]);

  // Wholesale threshold computation (total units and per-product units)
  const totalUnits = useMemo(
    () => items.reduce((acc, curr) => acc + curr.qty, 0),
    [items]
  );
  const totalPairs = totalUnits;

  const unitsByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.productId, (map.get(item.productId) || 0) + item.qty);
    }
    return map;
  }, [items]);

  const isWholesale = useMemo(() => {
    if (totalUnits >= WHOLESALE_THRESHOLD) return true;
    return items.some((item) => {
      const pUnits = unitsByProduct.get(item.productId) || 0;
      const minU = item.wholesaleMinUnits ?? WHOLESALE_THRESHOLD;
      return pUnits >= minU && item.wholesalePrice > 0 && item.wholesalePrice < item.retailPrice;
    });
  }, [items, totalUnits, unitsByProduct]);

  /** Returns the effective price for an item based on wholesale threshold */
  const getEffectivePrice = (item: CartItem): number => {
    const pUnits = unitsByProduct.get(item.productId) || 0;
    const minU = item.wholesaleMinUnits ?? WHOLESALE_THRESHOLD;
    const itemQualified =
      (pUnits >= minU || totalUnits >= WHOLESALE_THRESHOLD) &&
      item.wholesalePrice > 0 &&
      item.wholesalePrice < item.retailPrice;

    return itemQualified ? item.wholesalePrice : item.retailPrice;
  };

  const totalItems = totalUnits;
  const subtotal = useMemo(
    () => items.reduce((acc, curr) => acc + getEffectivePrice(curr) * curr.qty, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, totalUnits, unitsByProduct]
  );

  const addToCart = (product: FormattedProduct, variant: VariantParam, qty: number) => {
    let resolvedVariantId: string | undefined;
    let resolvedVariantLabel: string | undefined;
    let resolvedVariantName: string | undefined;
    let resolvedSku: string | undefined;
    let resolvedSize: number | undefined;
    let resolvedRetailPrice = product.retailPrice || product.price || 0;
    let resolvedWholesalePrice = product.wholesalePrice || resolvedRetailPrice;
    let maxStock = product.totalStock || 0;

    if (typeof variant === 'number') {
      resolvedSize = variant;
      const sizeStockObj = product.sizesStock?.find((s) => s.size === variant);
      if (sizeStockObj) maxStock = sizeStockObj.stock;
    } else if (typeof variant === 'string') {
      resolvedVariantName = variant;
      const variantObj = product.variants?.find((v) => v.name === variant || v._id === variant);
      if (variantObj) {
        resolvedVariantId = variantObj._id;
        resolvedSku = variantObj.sku;
        if (variantObj.retailPrice) resolvedRetailPrice = variantObj.retailPrice;
        if (variantObj.wholesalePrice) resolvedWholesalePrice = variantObj.wholesalePrice;
        maxStock = variantObj.stock;
      }
    } else if (variant && typeof variant === 'object') {
      resolvedVariantId = variant.variantId;
      resolvedVariantLabel = variant.variantLabel;
      resolvedVariantName = variant.variantName;
      resolvedSku = variant.sku;
      resolvedSize = variant.size;

      if (variant.retailPrice !== undefined) resolvedRetailPrice = variant.retailPrice;
      if (variant.wholesalePrice !== undefined) resolvedWholesalePrice = variant.wholesalePrice;
      if (variant.maxStock !== undefined) {
        maxStock = variant.maxStock;
      } else if (resolvedVariantId && product.variants) {
        const variantObj = product.variants.find((v) => v._id === resolvedVariantId || v.sku === resolvedSku);
        if (variantObj) maxStock = variantObj.stock;
      } else if (resolvedVariantName && product.variants) {
        const variantObj = product.variants.find((v) => v.name === resolvedVariantName);
        if (variantObj) maxStock = variantObj.stock;
      } else if (resolvedSize !== undefined && product.sizesStock) {
        const sizeStockObj = product.sizesStock.find((s) => s.size === resolvedSize);
        if (sizeStockObj) maxStock = sizeStockObj.stock;
      }
    }

    const imageUrl =
      product.images.find((img) => img.isPrincipal)?.url ||
      product.images[0]?.url ||
      '';

    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (item) => item.productId === product._id && matchVariant(item, variant)
      );

      if (existingIndex > -1) {
        const updated = [...prevItems];
        const newQty = Math.min(updated[existingIndex].qty + qty, maxStock);
        updated[existingIndex] = {
          ...updated[existingIndex],
          qty: newQty,
          maxStock,
        };
        return updated;
      }

      return [
        ...prevItems,
        {
          productId: product._id,
          variantId: resolvedVariantId,
          sku: resolvedSku,
          name: product.name,
          retailPrice: resolvedRetailPrice,
          wholesalePrice: resolvedWholesalePrice,
          variantLabel: resolvedVariantLabel,
          variantName: resolvedVariantName,
          size: resolvedSize,
          qty: Math.min(qty, maxStock > 0 ? maxStock : qty),
          image: imageUrl,
          maxStock: maxStock > 0 ? maxStock : 9999,
          wholesaleMinUnits: product.wholesale?.minUnits ?? WHOLESALE_THRESHOLD,
        },
      ];
    });

    setIsOpen(true);
  };

  const removeFromCart = (productId: string, variant?: VariantParam) => {
    setItems((prev) =>
      prev.filter((item) => !(item.productId === productId && matchVariant(item, variant)))
    );
  };

  const updateQuantity = (productId: string, variant: VariantParam, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId, variant);
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId && matchVariant(item, variant)) {
          const boundedQty = Math.min(qty, item.maxStock);
          return { ...item, qty: boundedQty };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);
  const toggleCart = () => setIsOpen((prev) => !prev);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        totalItems,
        totalPairs,
        totalUnits,
        isWholesale,
        subtotal,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        openCart,
        closeCart,
        toggleCart,
        getEffectivePrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser utilizado dentro de un CartProvider');
  }
  return context;
};
