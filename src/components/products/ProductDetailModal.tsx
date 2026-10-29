"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  ShoppingBag,
  Check,
  AlertCircle,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { FormattedProduct } from "./ProductCard";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/utils/formatCurrency";
import { formatOptionLabel } from "@/lib/variants";

export interface CartItemAddPayload {
  product: FormattedProduct;
  variantId?: string;
  variantLabel?: string;
  variantName?: string;
  sku?: string;
  retailPrice?: number;
  wholesalePrice?: number;
  qty: number;
}

interface ProductDetailModalProps {
  product: FormattedProduct | null;
  onClose: () => void;
  onAddToCart: (payload: CartItemAddPayload) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
}) => {
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [addedSuccess, setAddedSuccess] = useState(false);

  // Get current cart wholesale status to show live pricing
  const { isWholesale, totalUnits } = useCart();

  const hasVariants = Boolean(product?.variants && product.variants.length > 0);

  // Extract distinct option axes across variants
  const axes = React.useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return [];
    const keys = new Set<string>();
    for (const v of product.variants) {
      if (Array.isArray(v.options)) {
        for (const opt of v.options) {
          if (opt.key) keys.add(opt.key);
        }
      }
    }
    return Array.from(keys);
  }, [product]);

  // Visible label plus unit for every option, keyed by "axis:value" (e.g. "volumen:60" -> "60ml")
  const optionLabels = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of product?.variants || []) {
      for (const o of (v.options || []) as any[]) {
        map[`${o.key}:${o.value}`] = formatOptionLabel(o.label ?? o.value, o.unit);
      }
    }
    return map;
  }, [product]);

  // Options available for each axis
  const optionsByAxis = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const axis of axes) {
      const valSet = new Set<string>();
      for (const v of product?.variants || []) {
        if (Array.isArray(v.options)) {
          const match = v.options.find((o: any) => o.key === axis);
          if (match?.value) valSet.add(match.value);
        }
      }
      map[axis] = Array.from(valSet);
    }
    return map;
  }, [axes, product]);

  // Find currently matched variant
  const matchedVariant = React.useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return null;

    if (axes.length > 0) {
      const found = product.variants.find((v) => {
        if (v.active === false) return false;
        if (!Array.isArray(v.options)) return false;
        return axes.every((axis) => {
          const opt = v.options.find((o: any) => o.key === axis);
          return opt && opt.value === selectedOptions[axis];
        });
      });
      return found || product.variants[0];
    }

    if (selectedVariant) {
      return product.variants.find((v) => v.name === selectedVariant) || product.variants[0];
    }

    return product.variants[0];
  }, [product, axes, selectedOptions, selectedVariant]);

  useEffect(() => {
    if (product) {
      const primaryUrl =
        product.images.find((img) => img.isPrincipal)?.url ||
        product.images[0]?.url ||
        "";
      setSelectedImage(primaryUrl);

      if (product.variants && product.variants.length > 0) {
        const firstAvailable =
          product.variants.find((v) => (v.stock ?? 0) > 0 && v.active !== false) ||
          product.variants[0];

        if (Array.isArray(firstAvailable.options) && firstAvailable.options.length > 0) {
          const initialOpts: Record<string, string> = {};
          for (const opt of firstAvailable.options) {
            initialOpts[opt.key] = opt.value;
          }
          setSelectedOptions(initialOpts);
          setSelectedVariant(null);
        } else {
          setSelectedOptions({});
          setSelectedVariant(firstAvailable ? firstAvailable.name : null);
        }
      } else {
        setSelectedOptions({});
        setSelectedVariant(null);
      }
      setQuantity(1);
      setAddedSuccess(false);
    }
  }, [product]);

  if (!product) return null;

  const brandName =
    typeof product.brandId === "object" && product.brandId !== null
      ? product.brandId.name
      : "Producto";

  const categoryName =
    typeof product.categoryId === "object" && product.categoryId !== null
      ? product.categoryId.name
      : "";

  // Resolve prices for active variant
  const retailPrice =
    matchedVariant?.retailPrice ?? product.retailPrice ?? product.price ?? 0;
  const wholesalePrice =
    matchedVariant?.wholesalePrice ?? product.wholesalePrice ?? retailPrice;
  const minWholesaleUnits = product.wholesale?.minUnits ?? 5;
  const hasWholesaleDiscount =
    Boolean(product.hasWholesale || product.wholesale?.enabled) &&
    wholesalePrice < retailPrice;

  // Effective price based on current cart state
  const effectivePrice = isWholesale ? wholesalePrice : retailPrice;
  const unitsToWholesale = Math.max(0, minWholesaleUnits - totalUnits);

  // Get max stock
  let maxStock = 0;
  if (matchedVariant) {
    maxStock = matchedVariant.stock ?? 0;
  } else {
    maxStock = product.stock ?? product.totalStock ?? 0;
  }

  const canAddToCart = maxStock > 0 && (!hasVariants || !!matchedVariant);

  const formattedVariantLabel = matchedVariant
    ? Array.isArray(matchedVariant.options) && matchedVariant.options.length > 0
      ? matchedVariant.options.map((o: any) => formatOptionLabel(o.label ?? o.value, o.unit)).join(" / ")
      : matchedVariant.name
    : undefined;

  const handleOptionSelect = (axis: string, val: string) => {
    const nextOpts = { ...selectedOptions, [axis]: val };
    setSelectedOptions(nextOpts);
    setQuantity(1);

    // If category has imageAxis matching this axis, switch image
    const imageAxis =
      typeof product.categoryId === "object" && product.categoryId !== null
        ? product.categoryId.imageAxis
        : undefined;

    if (imageAxis && imageAxis.toLowerCase() === axis.toLowerCase()) {
      const matchingImg = product.images.find(
        (img) => img.axisValue && img.axisValue.toLowerCase() === val.toLowerCase()
      );
      if (matchingImg) {
        setSelectedImage(matchingImg.url);
      }
    }
  };

  const handleAddToCart = () => {
    if (!canAddToCart) return;
    onAddToCart({
      product,
      variantId: matchedVariant?._id?.toString(),
      variantLabel: formattedVariantLabel,
      variantName: matchedVariant?.name,
      sku: matchedVariant?.sku,
      retailPrice,
      wholesalePrice,
      qty: quantity,
    });
    setAddedSuccess(true);
    setTimeout(() => {
      setAddedSuccess(false);
      onClose();
    }, 1200);
  };

  const addToCartButton = (
    <button
      onClick={handleAddToCart}
      disabled={!canAddToCart || addedSuccess}
      className={`w-full py-4 rounded-full font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer ${
        addedSuccess
          ? "bg-[#007d48] text-white cursor-default"
          : canAddToCart
            ? "bg-[#111111] hover:bg-black text-white cursor-pointer"
            : "bg-[#f5f5f5] text-[#707072] cursor-not-allowed"
      }`}
    >
      {addedSuccess ? (
        <>
          <Check className="w-5 h-5" /> ¡Agregado al Carrito!
        </>
      ) : (
        <>
          <ShoppingBag className="w-5 h-5" /> Agregar al Carrito
        </>
      )}
    </button>
  );

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={product.name}
      hideTitle
      className="sm:max-w-4xl p-6 sm:p-8 gap-6"
      footer={addToCartButton}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Image Gallery */}
        <div className="space-y-4">
          {/* Main Preview Image */}
          <div className="relative aspect-square w-full bg-[#f5f5f5] overflow-hidden">
            {selectedImage && (
              <Image
                src={selectedImage}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover object-center"
              />
            )}
            {product.isOutOfStock && (
              <div className="absolute top-4 left-4 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-[#d30005]" /> SIN
                STOCK
              </div>
            )}
          </div>

          {/* Image Thumbnails Rail */}
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img.url)}
                  className={`relative w-16 h-16 bg-[#f5f5f5] border-2 transition-all flex-shrink-0 cursor-pointer ${
                    selectedImage === img.url
                      ? "border-[#111111]"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <Image
                    src={img.url}
                    alt={`Vista ${idx + 1}`}
                    fill
                    sizes="64px"
                    className="object-cover object-center"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Metadata & Size Selector */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#707072] uppercase tracking-wider">
                <span>{brandName}</span>
                {categoryName && <span>• {categoryName}</span>}
              </div>

              {product.isClearance && (
                <span className="inline-flex items-center gap-1 bg-[#d30005] text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs">
                  🔥 LIQUIDACIÓN
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111111] uppercase tracking-tight leading-tight">
              {product.name}
            </h2>

            {/* Pricing Section */}
            <div className="space-y-2">
              {product.isClearance ? (
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#d30005] mb-1">
                    Precio Liquidación
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black text-[#d30005]">
                      {formatPrice(wholesalePrice || retailPrice)}
                    </span>
                  </div>
                  <div className="mt-2 p-2.5 rounded-lg text-xs font-semibold bg-[#d30005]/10 text-[#d30005] border border-[#d30005]/20 flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Precio final promocional por liquidación de stock (válido tanto para compra minorista como mayorista).</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Active price */}
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-extrabold text-[#111111]">
                      {formatPrice(effectivePrice)}
                    </span>
                    {isWholesale && hasWholesaleDiscount && (
                      <span className="text-sm line-through text-[#707072]">
                        {formatPrice(retailPrice)}
                      </span>
                    )}
                  </div>

                  {/* Wholesale context */}
                  {hasWholesaleDiscount && (
                    <div
                      className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                        isWholesale
                          ? "bg-[#007d48]/10 text-[#007d48] border border-[#007d48]/20"
                          : "bg-[#f5f5f5] text-[#707072] border border-[#e5e5e5]"
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                      {isWholesale ? (
                        <span>
                          ¡Precio mayorista activo! ({formatPrice(wholesalePrice)}{" "}
                          c/u)
                        </span>
                      ) : (
                        <span>
                          Precio mayorista: {formatPrice(wholesalePrice)} — te
                          faltan{" "}
                          <strong>
                            {unitsToWholesale} unidad
                            {unitsToWholesale !== 1 ? "es" : ""}
                          </strong>{" "}
                          más en el carrito.
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Options / Variant / Size Selector */}
            <div className="space-y-4">
              {axes.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold text-[#111111] uppercase tracking-wider">
                      Opciones del Producto
                    </span>
                    <span className="text-xs text-[#707072]">
                      {maxStock > 0 ? (
                        <>Stock: <strong className="text-[#111111]">{maxStock} u.</strong></>
                      ) : (
                        <strong className="text-[#d30005]">Sin stock</strong>
                      )}
                      {matchedVariant?.sku && (
                        <span className="ml-2 font-mono text-[10px] text-[#707072]">
                          SKU: {matchedVariant.sku}
                        </span>
                      )}
                    </span>
                  </div>

                  {axes.map((axis) => {
                    const vals = optionsByAxis[axis] || [];
                    const currentVal = selectedOptions[axis];

                    return (
                      <div key={axis} className="space-y-1.5">
                        <label className="text-[11px] font-bold text-[#707072] uppercase tracking-wider capitalize">
                          {axis}:
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {vals.map((val) => {
                            const isSelected = currentVal === val;

                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleOptionSelect(axis, val)}
                                className={`px-3 py-1.5 font-bold text-xs rounded-none border transition-all ${
                                  isSelected
                                    ? "bg-[#111111] text-white border-[#111111] shadow-xs cursor-pointer"
                                    : "bg-white text-[#111111] border-[#e5e5e5] hover:border-[#111111] cursor-pointer"
                                }`}
                              >
                                {optionLabels[`${axis}:${val}`] ?? val}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : hasVariants ? (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-extrabold text-[#111111] uppercase tracking-wider">
                      Seleccionar Presentación / Variante
                    </label>
                    {selectedVariant && (
                      <span className="text-xs text-[#707072]">
                        Stock: <strong className="text-[#111111]">{maxStock} unidades</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {product.variants!.map((v) => {
                      const hasStock = (v.stock ?? 0) > 0;
                      const isSelected = selectedVariant === v.name;

                      return (
                        <button
                          key={v.name || v.sku}
                          disabled={!hasStock}
                          onClick={() => {
                            setSelectedVariant(v.name);
                            setQuantity(1);
                          }}
                          className={`px-4 py-2 font-bold text-xs rounded-none border transition-all ${
                            isSelected
                              ? "bg-[#111111] text-white border-[#111111] shadow-xs cursor-pointer"
                              : hasStock
                                ? "bg-white text-[#111111] border-[#e5e5e5] hover:border-[#111111] cursor-pointer"
                                : "bg-[#f5f5f5] text-[#cacacb] border-transparent cursor-not-allowed line-through"
                          }`}
                        >
                          {v.name} {hasStock ? `(${v.stock})` : '(Agotado)'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center py-2 border-b border-[#f5f5f5]">
                  <span className="text-xs font-bold text-[#707072] uppercase tracking-wider">
                    Stock disponible:
                  </span>
                  <span className="text-xs font-extrabold text-[#111111]">
                    {maxStock > 0 ? `${maxStock} unidades` : 'Agotado'}
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="border-t border-b border-[#f5f5f5] py-3">
              <p className="text-xs text-[#707072] leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Specifications Block */}
            {product.specs && product.specs.length > 0 && (
              <div className="border-b border-[#f5f5f5] pb-3 space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#111111]">
                  Ficha Técnica
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {product.specs.map((spec) => (
                    <div key={spec.key} className="bg-[#f5f5f5] p-2 border border-[#e5e5e5]">
                      <span className="text-[#707072] font-semibold capitalize block text-[10px]">
                        {spec.key}
                      </span>
                      <span className="font-bold text-[#111111]">
                        {typeof spec.value === 'boolean'
                          ? spec.value
                            ? 'Sí'
                            : 'No'
                          : formatOptionLabel(spec.label ?? String(spec.value), spec.unit)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            {canAddToCart && (
              <div className="flex items-center gap-4 pt-2">
                <label className="text-xs font-extrabold text-[#111111] uppercase tracking-wider">
                  Cantidad:
                </label>
                <div className="flex items-center border border-[#e5e5e5]">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="px-3 py-1.5 text-sm font-bold text-[#111111] hover:bg-[#f5f5f5] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    -
                  </button>
                  <span className="px-4 text-xs font-bold text-[#111111]">
                    {quantity}
                  </span>
                  <button
                    onClick={() =>
                      setQuantity((q) => Math.min(maxStock, q + 1))
                    }
                    disabled={quantity >= maxStock}
                    className="px-3 py-1.5 text-sm font-bold text-[#111111] hover:bg-[#f5f5f5] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-[#707072]">
            <ShieldCheck className="w-4 h-4 text-[#007d48]" />
            <span>Pedido respaldado por confirmación en WhatsApp</span>
          </div>
        </div>
      </div>
    </ResponsiveModal>
  );
};
