"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  X,
  ShoppingBag,
  Check,
  AlertCircle,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { FormattedProduct } from "./ProductCard";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/utils/formatCurrency";

export interface CartItemAddPayload {
  product: FormattedProduct;
  variantName?: string;
  size?: number;
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
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [addedSuccess, setAddedSuccess] = useState(false);

  // Get current cart wholesale status to show live pricing
  const { isWholesale, totalUnits } = useCart();

  const hasVariants = Boolean(product?.variants && product.variants.length > 0);
  const hasSizes = Boolean(product?.sizesStock && product.sizesStock.length > 0);

  useEffect(() => {
    if (product) {
      const primaryUrl =
        product.images.find((img) => img.isPrincipal)?.url ||
        product.images[0]?.url ||
        "";
      setSelectedImage(primaryUrl);

      if (product.variants && product.variants.length > 0) {
        const firstAvailable = product.variants.find((v) => v.stock > 0) || product.variants[0];
        setSelectedVariant(firstAvailable ? firstAvailable.name : null);
        setSelectedSize(null);
      } else if (product.sizesStock && product.sizesStock.length > 0) {
        const firstAvailable = product.sizesStock.find((s) => s.stock > 0);
        setSelectedSize(firstAvailable ? firstAvailable.size : null);
        setSelectedVariant(null);
      } else {
        setSelectedVariant(null);
        setSelectedSize(null);
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

  const typeName =
    typeof product.typeId === "object" && product.typeId !== null
      ? product.typeId.name
      : "";

  // Resolve prices with legacy fallback
  const retailPrice = product.retailPrice ?? product.price ?? 0;
  const wholesalePrice = product.wholesalePrice ?? retailPrice;
  const hasWholesaleDiscount = wholesalePrice < retailPrice;

  // Effective price based on current cart state
  const effectivePrice = isWholesale ? wholesalePrice : retailPrice;
  const unitsToWholesale = Math.max(0, 5 - totalUnits);

  // Get max stock
  let maxStock = 0;
  if (hasVariants) {
    const currentVar = product.variants?.find((v) => v.name === selectedVariant);
    maxStock = currentVar ? currentVar.stock : 0;
  } else if (hasSizes) {
    const currentSizeObj = product.sizesStock?.find((s) => s.size === selectedSize);
    maxStock = currentSizeObj ? currentSizeObj.stock : 0;
  } else {
    maxStock = product.stock ?? product.totalStock ?? 0;
  }

  const canAddToCart =
    maxStock > 0 &&
    (!hasVariants || !!selectedVariant) &&
    (!hasSizes || selectedSize !== null);

  const handleAddToCart = () => {
    if (!canAddToCart) return;
    onAddToCart({
      product,
      variantName: selectedVariant ?? undefined,
      size: selectedSize ?? undefined,
      qty: quantity,
    });
    setAddedSuccess(true);
    setTimeout(() => {
      setAddedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-none shadow-2xl border border-[#e5e5e5] p-6 sm:p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2.5 text-[#111111] bg-[#f5f5f5] hover:bg-[#111111] hover:text-white rounded-full transition-colors z-10 cursor-pointer"
          aria-label="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

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
                  {typeName && <span>• {typeName}</span>}
                  <span>• {product.gender}</span>
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
                              {pairsToWholesale} par
                              {pairsToWholesale !== 1 ? "es" : ""}
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
              <div>
                {hasVariants ? (
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
                        const hasStock = v.stock > 0;
                        const isSelected = selectedVariant === v.name;

                        return (
                          <button
                            key={v.name}
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
                ) : hasSizes ? (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-extrabold text-[#111111] uppercase tracking-wider">
                        Seleccionar Talle
                      </label>
                      {selectedSize !== null && (
                        <span className="text-xs text-[#707072]">
                          Stock disponible:{" "}
                          <strong className="text-[#111111]">
                            {maxStock} unidades
                          </strong>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      {product.sizesStock!
                        .filter((s) => {
                          const displayedSizes =
                            (product as any).displayedSizes || [];
                          return (
                            displayedSizes.length === 0 ||
                            displayedSizes.includes(s.size)
                          );
                        })
                        .map((s) => {
                          const hasStock = s.stock > 0;
                          const isSelected = selectedSize === s.size;

                          return (
                            <button
                              key={s.size}
                              disabled={!hasStock}
                              onClick={() => {
                                setSelectedSize(s.size);
                                setQuantity(1);
                              }}
                              className={`h-11 font-bold text-xs rounded-none border transition-all ${
                                isSelected
                                  ? "bg-[#111111] text-white border-[#111111] shadow-xs cursor-pointer"
                                  : hasStock
                                    ? "bg-white text-[#111111] border-[#e5e5e5] hover:border-[#111111] cursor-pointer"
                                    : "bg-[#f5f5f5] text-[#cacacb] border-transparent cursor-not-allowed line-through"
                              }`}
                            >
                              {s.size}
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

              <div className="border-t border-b border-[#f5f5f5] py-3">
                <p className="text-xs text-[#707072] leading-relaxed">
                  {product.description}
                </p>
              </div>

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

            {/* Add to Cart CTA */}
            <div className="space-y-3 pt-4 border-t border-[#f5f5f5]">
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

              <div className="flex items-center justify-center gap-2 text-xs text-[#707072]">
                <ShieldCheck className="w-4 h-4 text-[#007d48]" />
                <span>Pedido respaldado por confirmación en WhatsApp</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
