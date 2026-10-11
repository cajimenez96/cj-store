"use client";

import React from "react";
import Image from "next/image";
import { Eye, AlertCircle, Tag } from "lucide-react";
import type { IProductImage, ISizeStock, IVariantStock } from "@/models/Product";

import { formatPrice } from "@/utils/formatCurrency";

export interface FormattedProduct {
  _id: string;
  name: string;
  description: string;
  /** @deprecated Use retailPrice instead */
  price?: number;
  retailPrice: number;
  wholesalePrice: number;
  gender?: string | null;
  brandId: { _id: string; name: string } | string;
  typeId: { _id: string; name: string } | string;
  images: IProductImage[];
  variants?: IVariantStock[];
  stock?: number;
  /** @deprecated Legacy shoe sizes */
  sizesStock?: ISizeStock[];
  totalStock: number;
  isOutOfStock: boolean;
  isClearance?: boolean;
}

interface ProductCardProps {
  product: FormattedProduct;
  onSelectProduct: (product: FormattedProduct) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelectProduct,
}) => {
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

  // Get primary image or first available
  const primaryImage =
    product.images.find((img) => img.isPrincipal)?.url ||
    product.images[0]?.url ||
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80";

  const availableOptions = (product.variants && product.variants.length > 0)
    ? product.variants.filter((v) => v.stock > 0).map((v) => v.name)
    : (product.sizesStock && product.sizesStock.length > 0)
    ? product.sizesStock.filter((s) => s.stock > 0).map((s) => String(s.size))
    : [];

  return (
    <div
      onClick={() => onSelectProduct(product)}
      className="group cursor-pointer bg-white flex flex-col justify-between transition-all duration-200"
    >
      {/* 1. Image Container with Studio Soft-Cloud Background (#f5f5f5) */}
      <div className="relative aspect-square w-full bg-[#f5f5f5] overflow-hidden flex items-center justify-center">
        <Image
          src={primaryImage}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={`object-cover object-center transition-transform duration-500 group-hover:scale-105 ${
            product.isOutOfStock ? "grayscale opacity-60" : ""
          }`}
        />

        {/* Badge Overlay (Top Left) */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          {product.isClearance && !product.isOutOfStock && (
            <span className="inline-flex items-center gap-1 bg-[#d30005] text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md animate-pulse">
              🔥 LIQUIDACIÓN
            </span>
          )}
          {product.isOutOfStock ? (
            <span className="inline-flex items-center gap-1 bg-[#111111] text-white text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
              <AlertCircle className="w-3 h-3 text-[#d30005]" /> SIN STOCK
            </span>
          ) : (
            product.gender === "Niño" && (
              <span className="bg-white/90 text-[#111111] text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full backdrop-blur-sm border border-[#e5e5e5] shadow-xs">
                {product.gender}
              </span>
            )
          )}
        </div>

        {/* Hover Quick Action Overlay */}
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button className="bg-white text-[#111111] font-bold text-xs px-4 py-2 rounded-full shadow-md flex items-center gap-1.5 hover:bg-[#111111] hover:text-white transition-all transform translate-y-2 group-hover:translate-y-0">
            <Eye className="w-3.5 h-3.5" /> Ver Detalle
          </button>
        </div>
      </div>

      {/* 2. Metadata Section */}
      <div className="pt-3 pb-2 flex flex-col gap-1">
        <div className="flex justify-between items-center text-xs text-[#707072] font-semibold uppercase tracking-wider">
          <span>{brandName}</span>
          <span className="hidden md:block">{typeName || ""}</span>
        </div>

        <h3 className="font-bold text-base text-[#111111] group-hover:underline line-clamp-1 leading-snug">
          {product.name}
        </h3>

        {/* Available Options / Sizes Pills Preview */}
        <div className="hidden md:flex items-center gap-1 my-1 overflow-x-auto no-scrollbar py-0.5">
          {availableOptions.length > 0 ? (
            availableOptions.slice(0, 5).map((opt) => (
              <span
                key={opt}
                className="text-[10px] font-semibold bg-[#f5f5f5] text-[#111111] px-1.5 py-0.5 rounded-sm border border-[#e5e5e5]"
              >
                {opt}
              </span>
            ))
          ) : product.totalStock > 0 ? (
            <span className="text-[10px] font-semibold text-[#007d48]">Disponible</span>
          ) : (
            <span className="text-[11px] text-[#707072] italic">Agotado</span>
          )}
          {availableOptions.length > 5 && (
            <span className="text-[10px] text-[#707072] font-medium">
              +{availableOptions.length - 5}
            </span>
          )}
        </div>

        {/* Price Row */}
        {product.isClearance ? (
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <span className="font-extrabold text-lg text-[#d30005]">
              {formatPrice(wholesalePrice || retailPrice)}
            </span>
            <span className="text-[10px] font-extrabold text-[#d30005] bg-[#d30005]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Liquidación
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="font-extrabold text-lg text-[#111111]">
                {formatPrice(retailPrice)}
              </span>
              {hasWholesaleDiscount && (
                <span className="text-xs font-bold text-[#007d48] bg-[#007d48]/10 px-2 py-0.5 rounded-full">
                  Mayorista: {formatPrice(wholesalePrice)}
                </span>
              )}
            </div>
            {hasWholesaleDiscount && (
              <p className="text-[10px] text-[#707072] font-medium mt-0.5">
                ✦ Precio mayorista 5 pares o más
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
