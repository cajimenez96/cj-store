'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, Save, Search, ShoppingBag, ZoomIn } from 'lucide-react';
import { AdminOrderItem } from './OrderDetailModal';
import { formatPrice } from '@/utils/formatCurrency';
import { toast } from '@/components/ui/sonner';
import Image from 'next/image';

interface EditableOrderItem {
  productId: string;
  name: string;
  image?: string;
  variantId?: string;
  sku?: string;
  variantLabel?: string;
  variantName?: string;
  qty: number;
  unitPrice: number;
  appliedPriceType: 'retail' | 'wholesale' | 'custom';
  subtotal: number;
}

interface OrderEditModalProps {
  order: AdminOrderItem | null;
  onClose: () => void;
  onSaved: () => void;
}

interface SearchVariant {
  _id: string;
  sku: string;
  name?: string;
  options?: { key: string; value: string }[];
  retailPrice: number;
  wholesalePrice?: number;
  stock: number;
  active?: boolean;
}

interface ProductSearchResult {
  _id: string;
  name: string;
  retailPrice: number;
  wholesalePrice: number;
  stock?: number;
  variants?: SearchVariant[];
  images?: { url: string; isPrincipal?: boolean }[];
  brandId?: { name: string } | string;
}

const variantLabelOf = (variant: SearchVariant): string =>
  variant.options && variant.options.length > 0
    ? variant.options.map((o) => o.value).join(' / ')
    : variant.name || variant.sku;

export const OrderEditModal: React.FC<OrderEditModalProps> = ({ order, onClose, onSaved }) => {
  const [items, setItems] = useState<EditableOrderItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('transferencia');
  const [guestName, setGuestName] = useState<string>('');
  const [guestLastName, setGuestLastName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // Product search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [saving, setSaving] = useState(false);

  // Initialize from order
  useEffect(() => {
    if (order) {
      setItems(
        order.items.map((i) => ({
          productId: i.productId,
          name: i.name,
          image: i.image,
          variantId: i.variantId,
          sku: i.sku,
          variantLabel: i.variantLabel,
          variantName: i.variantName,
          qty: i.qty,
          unitPrice: i.unitPrice,
          appliedPriceType: (i.appliedPriceType as 'retail' | 'wholesale' | 'custom') ?? 'custom',
          subtotal: i.subtotal,
        }))
      );
      setDiscount(order.discount ?? 0);
      setNotes(order.notes ?? '');
      setPaymentMethod(order.paymentMethod ?? 'transferencia');
      setGuestName(order.guest.name);
      setGuestLastName(order.guest.lastName);
      setGuestPhone(order.guest.phone);
    }
  }, [order]);

  if (!order) return null;

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const total = Math.max(0, subtotal - discount);

  const updateItem = (idx: number, field: keyof EditableOrderItem, value: number | string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        updated.subtotal = updated.unitPrice * updated.qty;
        return updated;
      })
    );
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Product search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/products?search=${encodeURIComponent(searchQuery)}&active=true&limit=10`);
      const json = await res.json();
      if (json.ok) setSearchResults(json.data);
    } catch {
      // silently fail
    } finally {
      setSearching(false);
    }
  };

  const addProductToOrder = (product: ProductSearchResult, variant?: SearchVariant) => {
    const existingIdx = items.findIndex(
      (i) => i.productId === product._id && i.variantId === variant?._id
    );
    if (existingIdx > -1) {
      updateItem(existingIdx, 'qty', items[existingIdx].qty + 1);
      return;
    }

    const mainImg = product.images?.find((img) => img.isPrincipal)?.url || product.images?.[0]?.url || '';
    const unitPrice = variant?.retailPrice ?? product.retailPrice ?? 0;
    setItems((prev) => [
      ...prev,
      {
        productId: product._id,
        name: product.name,
        image: mainImg,
        variantId: variant?._id,
        sku: variant?.sku,
        variantLabel: variant ? variantLabelOf(variant) : undefined,
        variantName: variant?.name,
        qty: 1,
        unitPrice,
        appliedPriceType: 'custom',
        subtotal: unitPrice,
      },
    ]);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error('La orden debe tener al menos un producto.');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/admin/orders/${order._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest: { name: guestName, lastName: guestLastName, phone: guestPhone },
          items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            image: i.image,
            variantId: i.variantId,
            sku: i.sku,
            variantLabel: i.variantLabel,
            variantName: i.variantName,
            qty: i.qty,
            unitPrice: i.unitPrice,
            appliedPriceType: i.appliedPriceType,
          })),
          discount,
          notes,
          paymentMethod,
        }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'Error al guardar cambios');

      toast.success(`Pedido #${order.orderNumber} actualizado`, {
        description: 'Los cambios fueron guardados exitosamente.',
      });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar', {
        description: 'Revisá los datos e intentá nuevamente.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative bg-white w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-none shadow-2xl border border-[#e5e5e5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-[#e5e5e5] px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-base font-extrabold uppercase tracking-tight text-[#111111]">
            Editar Pedido #{order.orderNumber}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[#111111] bg-[#f5f5f5] hover:bg-[#111111] hover:text-white rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Customer Data */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#111111]">
              Datos del Cliente
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Nombre', value: guestName, setter: setGuestName },
                { label: 'Apellido', value: guestLastName, setter: setGuestLastName },
                { label: 'Teléfono', value: guestPhone, setter: setGuestPhone },
              ].map(({ label, value, setter }) => (
                <div key={label}>
                  <label className="block text-[10px] font-bold text-[#707072] uppercase mb-1">{label}</label>
                  <input
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-medium py-2 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#111111]">
              Productos ({items.length})
            </h3>

            <div className="border border-[#e5e5e5] divide-y divide-[#e5e5e5]">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center gap-3 text-xs">
                  {/* Thumbnail */}
                  <button
                    type="button"
                    onClick={() => item.image && setPreviewImage({ url: item.image, name: item.name })}
                    disabled={!item.image}
                    className={`relative w-10 h-10 bg-white border border-[#e5e5e5] shrink-0 overflow-hidden flex items-center justify-center group ${
                      item.image
                        ? 'cursor-zoom-in hover:border-[#111111] transition-all'
                        : 'cursor-default'
                    }`}
                    title={item.image ? 'Ampliar foto del producto' : undefined}
                  >
                    {item.image ? (
                      <>
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="40px"
                          className="object-cover object-center group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <ZoomIn className="w-3.5 h-3.5 text-white drop-shadow-md" />
                        </div>
                      </>
                    ) : (
                      <ShoppingBag className="w-4 h-4 text-[#707072]" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#111111] truncate">{item.name}</p>
                    {(item.variantLabel || item.variantName) && (
                      <p className="text-[#707072]">{item.variantLabel || item.variantName}</p>
                    )}
                  </div>

                  {/* Qty */}
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-[#707072]">Cant.</label>
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => updateItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 text-center bg-[#f5f5f5] text-[#111111] font-bold py-1 border border-[#e5e5e5] focus:outline-none"
                    />
                  </div>

                  {/* Unit price */}
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-[#707072]">Precio</label>
                    <input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, 'unitPrice', Math.max(0, Number(e.target.value)))}
                      className="w-24 text-right bg-[#f5f5f5] text-[#111111] font-bold py-1 border border-[#e5e5e5] focus:outline-none"
                    />
                  </div>

                  {/* Subtotal */}
                  <span className="w-24 text-right font-extrabold text-[#111111]">
                    {formatPrice(item.unitPrice * item.qty)}
                  </span>

                  <button
                    onClick={() => removeItem(idx)}
                    className="text-[#707072] hover:text-[#d30005] transition-colors cursor-pointer p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Product Search to Add */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#111111]">
              Agregar Producto
            </h3>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Buscar producto por nombre..."
                  className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-medium py-2.5 pl-9 pr-4 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                />
                <Search className="w-4 h-4 text-[#707072] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-black transition-colors disabled:opacity-50 cursor-pointer"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="border border-[#e5e5e5] divide-y divide-[#e5e5e5] max-h-60 overflow-y-auto">
                {searchResults.map((prod) => {
                  const mainImage = prod.images?.find((img) => img.isPrincipal)?.url || prod.images?.[0]?.url;
                  const brandName = typeof prod.brandId === 'object' ? prod.brandId?.name : '';
                  const availableVariants = (prod.variants ?? []).filter(
                    (v) => v.active !== false && v.stock > 0
                  );

                  return (
                    <div key={prod._id} className="p-3 text-xs space-y-2 hover:bg-[#fafafa] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 bg-[#f5f5f5] flex-shrink-0 border border-[#e5e5e5] overflow-hidden">
                          {mainImage ? (
                            <Image
                              src={mainImage}
                              alt={prod.name}
                              fill
                              sizes="48px"
                              className="object-cover object-center"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#707072] text-[9px] uppercase font-bold">
                              Sin foto
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#111111] truncate">{prod.name}</p>
                          {brandName && (
                            <p className="text-[10px] text-[#707072]">{brandName}</p>
                          )}
                          <p className="text-[#707072] text-[10px] mt-0.5">
                            Min: {formatPrice(prod.retailPrice)} • May: {formatPrice(prod.wholesalePrice)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pl-0 sm:pl-[60px]">
                        <span className="text-[10px] font-bold text-[#707072]">Variantes:</span>
                        {availableVariants.map((v) => (
                          <button
                            key={v._id}
                            onClick={() => addProductToOrder(prod, v)}
                            className="px-2 py-0.5 bg-[#f5f5f5] text-[#111111] font-bold text-[11px] border border-[#e5e5e5] hover:bg-[#111111] hover:text-white transition-all cursor-pointer"
                          >
                            {variantLabelOf(v)} ({v.stock})
                          </button>
                        ))}
                        {availableVariants.length === 0 && (prod.stock ?? 0) > 0 && (
                          <button
                            onClick={() => addProductToOrder(prod)}
                            className="px-2 py-0.5 bg-[#f5f5f5] text-[#111111] font-bold text-[11px] border border-[#e5e5e5] hover:bg-[#111111] hover:text-white transition-all cursor-pointer"
                          >
                            Stock general ({prod.stock})
                          </button>
                        )}
                        {availableVariants.length === 0 && !((prod.stock ?? 0) > 0) && (
                          <span className="text-[10px] text-[#707072]">Sin stock disponible</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Discount & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#707072] uppercase">Descuento ($ ARS)</label>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-extrabold py-2 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#707072] uppercase">Medio de Pago</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-bold py-2 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111] cursor-pointer"
              >
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-[#707072] uppercase">Notas / Observaciones</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-medium py-2 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
            />
          </div>

          {/* Totals Summary */}
          <div className="bg-[#f5f5f5] p-4 border border-[#e5e5e5] text-xs space-y-1">
            <div className="flex justify-between text-[#707072]">
              <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-[#007d48] font-semibold">
                <span>Descuento</span><span>-{formatPrice(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-base text-[#111111] pt-2 border-t border-[#e5e5e5]">
              <span>Total acordado</span><span>{formatPrice(total)}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-[#e5e5e5] px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="py-3 px-5 bg-[#f5f5f5] text-[#111111] font-bold text-xs uppercase tracking-wider rounded-full hover:bg-[#e5e5e5] transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="py-3 px-6 bg-[#111111] text-white font-bold text-xs uppercase tracking-wider rounded-full flex items-center gap-2 hover:bg-black transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* Image Preview Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative bg-white max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-[#e5e5e5] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
              <h4 className="font-extrabold text-sm uppercase text-[#111111] truncate pr-4">
                {previewImage.name}
              </h4>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 text-[#111111] bg-[#f5f5f5] hover:bg-[#111111] hover:text-white rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full h-80 sm:h-96 bg-[#f5f5f5] border border-[#e5e5e5] overflow-hidden flex items-center justify-center">
              <Image
                src={previewImage.url}
                alt={previewImage.name}
                fill
                sizes="(max-width: 768px) 100vw, 512px"
                className="object-contain p-2"
                priority
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
