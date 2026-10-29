'use client';

import React from 'react';
import Image from 'next/image';
import { ShoppingBag, Plus, Minus, Trash2, ArrowRight, Tag, Zap } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/utils/formatCurrency';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const WHOLESALE_THRESHOLD = 5;

interface CartDrawerProps {
  onStartCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onStartCheckout }) => {
  const {
    items,
    isOpen,
    closeCart,
    updateQuantity,
    removeFromCart,
    totalItems,
    totalPairs,
    isWholesale,
    subtotal,
    getEffectivePrice,
  } = useCart();


  const pairsToWholesale = Math.max(0, WHOLESALE_THRESHOLD - totalPairs);
  const wholesaleProgressPct = Math.min(100, (totalPairs / WHOLESALE_THRESHOLD) * 100);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent side="right" className="w-screen max-w-md sm:max-w-md gap-0 p-0 flex flex-col">
        <SheetHeader className="sr-only">
          <SheetTitle>Tu Carrito ({totalItems})</SheetTitle>
        </SheetHeader>

        <div className="shrink-0 p-6 pr-14 border-b border-[#e5e5e5] flex items-center gap-2 bg-white">
          <ShoppingBag className="w-5 h-5 text-[#111111]" />
          <h2 className="text-lg font-extrabold uppercase tracking-tight text-[#111111]">
            Tu Carrito ({totalItems})
          </h2>
        </div>

        {/* 2. Wholesale Progress Banner */}
        {items.length > 0 && (
          <div className={`shrink-0 px-6 py-3 border-b border-[#e5e5e5] ${isWholesale ? 'bg-[#007d48]/10' : 'bg-[#f5f5f5]'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[11px] font-bold flex items-center gap-1 ${isWholesale ? 'text-[#007d48]' : 'text-[#707072]'}`}>
                {isWholesale ? (
                  <><Zap className="w-3 h-3 fill-current" /> ¡Precio mayorista activo en todos los productos!</>
                ) : (
                  <><Tag className="w-3 h-3" /> {pairsToWholesale} unidad{pairsToWholesale !== 1 ? 'es' : ''} más para precio mayorista</>
                )}
              </span>
              <span className="text-[10px] text-[#707072] font-semibold">{totalPairs}/{WHOLESALE_THRESHOLD}</span>
            </div>
            <div className="w-full bg-[#e5e5e5] rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${isWholesale ? 'bg-[#007d48]' : 'bg-[#111111]'}`}
                style={{ width: `${wholesaleProgressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* 3. Items List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 divide-y divide-[#f5f5f5]">
          {items.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <ShoppingBag className="w-12 h-12 text-[#707072] mx-auto stroke-1" />
              <p className="text-sm font-bold text-[#111111] uppercase tracking-tight">
                Tu carrito está vacío
              </p>
              <p className="text-xs text-[#707072] max-w-xs mx-auto">
                Explorá nuestro catálogo y elegí tus modelos favoritos para agregarlos.
              </p>
              <button
                onClick={closeCart}
                className="mt-4 px-6 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-black transition-all cursor-pointer"
              >
                Ir al Catálogo
              </button>
            </div>
          ) : (
            items.map((item) => {
              const effectivePrice = getEffectivePrice(item);
              const isDiscounted = item.wholesalePrice > 0 && effectivePrice < item.retailPrice;
              const itemKey = `${item.productId}-${item.variantId || item.variantName || 'default'}`;
              const variantIdentifier = item.variantId ? { variantId: item.variantId } : item.variantName;

              return (
                <div
                  key={itemKey}
                  className="pt-4 first:pt-0 flex gap-4 items-center"
                >
                  {/* Thumbnail */}
                  <div className="relative w-20 h-20 bg-[#f5f5f5] flex-shrink-0 border border-[#e5e5e5]">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="80px"
                        className="object-cover object-center"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#f5f5f5]" />
                    )}
                  </div>

                  {/* Details & Controls */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-xs text-[#111111] truncate pr-2">
                        {item.name}
                      </h3>
                      <button
                        onClick={() => removeFromCart(item.productId, variantIdentifier)}
                        className="text-[#707072] hover:text-[#d30005] transition-colors p-1 cursor-pointer"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {(item.variantLabel || item.variantName) && (
                      <p className="text-[11px] font-semibold text-[#707072]">
                        Variante: <strong className="text-[#111111]">{item.variantLabel || item.variantName}</strong>
                      </p>
                    )}

                    <div className="flex justify-between items-center pt-1">
                      {/* Qty Counter */}
                      <div className="flex items-center border border-[#e5e5e5]">
                        <button
                          onClick={() => updateQuantity(item.productId, variantIdentifier, item.qty - 1)}
                          className="px-2 py-0.5 text-xs font-bold text-[#111111] hover:bg-[#f5f5f5] cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-bold text-[#111111]">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, variantIdentifier, item.qty + 1)}
                          disabled={item.qty >= item.maxStock}
                          className="px-2 py-0.5 text-xs font-bold text-[#111111] hover:bg-[#f5f5f5] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Subtotal with optional wholesale highlight */}
                      <div className="text-right">
                        <span className={`font-extrabold text-sm ${isDiscounted ? 'text-[#007d48]' : 'text-[#111111]'}`}>
                          {formatPrice(effectivePrice * item.qty)}
                        </span>
                        {isDiscounted && (
                          <span className="block text-[10px] text-[#707072] line-through">
                            {formatPrice(item.retailPrice * item.qty)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 4. Footer Summary & Action */}
        {items.length > 0 && (
          <div className="shrink-0 p-6 border-t border-[#e5e5e5] bg-[#f5f5f5] space-y-4">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[#707072]">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {isWholesale && (
                <div className="flex justify-between text-[#007d48] font-semibold">
                  <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Precio mayorista aplicado</span>
                  <span>✓</span>
                </div>
              )}
              <div className="flex justify-between text-[#707072]">
                <span>Envío</span>
                <span className="font-semibold text-[#007d48]">A coordinar por WhatsApp</span>
              </div>
              <div className="flex justify-between font-extrabold text-base text-[#111111] pt-2 border-t border-[#e5e5e5]">
                <span>Total estimado</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                closeCart();
                onStartCheckout();
              }}
              className="w-full py-4 bg-[#111111] hover:bg-black text-white font-bold text-sm uppercase tracking-wider rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer"
            >
              <span>Iniciar Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
