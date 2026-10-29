'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { MessageSquare, Check, Ban, Clock, Loader2, ShieldCheck, Edit3, ShoppingBag, ZoomIn } from 'lucide-react';
import type { OrderStatus } from '@/models/Order';
import { formatPrice } from '@/utils/formatCurrency';
import { useSettings } from '@/context/SettingsContext';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

export interface AdminOrderItem {
  _id: string;
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  origin?: 'web' | 'admin_direct';
  paymentMethod: 'transferencia' | 'efectivo' | 'tarjeta' | 'otro';
  subtotal: number;
  discount: number;
  total: number;
  notes?: string;
  guest: {
    name: string;
    lastName: string;
    phone: string;
  };
  items: Array<{
    productId: string;
    name: string;
    image?: string;
    variantId?: string;
    sku?: string;
    variantLabel?: string;
    variantName?: string;
    qty: number;
    appliedPriceType?: 'retail' | 'wholesale' | 'custom';
    unitPrice: number;
    subtotal: number;
  }>;
}

interface OrderDetailModalProps {
  order: AdminOrderItem | null;
  onClose: () => void;
  onAuthorize: (id: string, paymentMethod: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onEdit: (order: AdminOrderItem) => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pendiente: { bg: 'bg-[#f59e0b]', text: 'text-white', label: 'PENDIENTE' },
  autorizado: { bg: 'bg-[#007d48]', text: 'text-white', label: 'AUTORIZADO' },
  cancelado: { bg: 'bg-[#d30005]', text: 'text-white', label: 'CANCELADO' },
  // Legacy statuses
  completada: { bg: 'bg-[#007d48]', text: 'text-white', label: 'COMPLETADA' },
  confirmada: { bg: 'bg-[#007d48]', text: 'text-white', label: 'CONFIRMADA' },
  cancelada: { bg: 'bg-[#d30005]', text: 'text-white', label: 'CANCELADA' },
};

const PRICE_TYPE_LABELS: Record<string, string> = {
  retail: 'Minorista',
  wholesale: 'Mayorista',
  custom: 'Precio acordado',
};

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  onClose,
  onAuthorize,
  onCancel,
  onEdit,
}) => {
  const [updating, setUpdating] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const { settings } = useSettings();
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  if (!order) return null;

  const whatsappPhone = order.guest.phone.replace(/[^0-9]/g, '');
  const itemsList = order.items
    .map((item) => {
      const variantDescription = item.variantLabel || item.variantName;
      const variantText = variantDescription ? `\n   - Variante: ${variantDescription}` : '';
      return `• ${item.qty}x ${item.name}${variantText}\n   - Subtotal: ${formatPrice(item.subtotal)}`;
    })
    .join('\n\n');

  const whatsappMessage = `¡Hola ${order.guest.name}! Te escribimos de ${settings.storeName} respecto a tu solicitud #${order.orderNumber} ✨

📦 *DETALLE DE TU PEDIDO:*
${itemsList}

💰 *TOTAL:* ${formatPrice(order.total)}`;

  const whatsappUrl = `https://wa.me/${whatsappPhone.startsWith('54') ? whatsappPhone : `54${whatsappPhone}`}?text=${encodeURIComponent(
    whatsappMessage
  )}`;

  const statusInfo = STATUS_COLORS[order.status] ?? STATUS_COLORS['pendiente'];
  const isPending = order.status === 'pendiente';
  const isFinalized = ['autorizado', 'cancelado', 'completada', 'cancelada'].includes(order.status);

  const handleAuthorize = async () => {
    setUpdating(true);
    try {
      await onAuthorize(order._id, paymentMethod);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    setUpdating(true);
    try {
      await onCancel(order._id);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => !open && onClose()}
      title="Detalle del pedido"
      hideTitle
      className="sm:max-w-2xl p-6 sm:p-8 gap-6"
    >
      {/* Header */}
      <div className="space-y-1 border-b border-[#e5e5e5] pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-extrabold uppercase tracking-tight text-[#111111]">
            Solicitud #{order.orderNumber}
          </h2>

          <span className={`${statusInfo.bg} ${statusInfo.text} text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1`}>
            {order.status === 'autorizado' ? <ShieldCheck className="w-3 h-3" /> :
             order.status === 'pendiente' ? <Clock className="w-3 h-3" /> :
             <Ban className="w-3 h-3" />}
            {statusInfo.label}
          </span>

          {order.origin === 'admin_direct' && (
            <span className="bg-[#111111] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              VENTA DIRECTA
            </span>
          )}
        </div>
        <p className="text-xs text-[#707072]">
          Fecha de emisión: {new Date(order.createdAt).toLocaleString('es-AR')}
        </p>
      </div>

      {/* Customer Box + WhatsApp Action */}
      <div className="bg-[#f5f5f5] p-4 border border-[#e5e5e5] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] font-bold text-[#707072] uppercase tracking-wider block">
            CLIENTE / COMPRADOR
          </span>
          <h4 className="font-extrabold text-sm text-[#111111]">
            {order.guest.name} {order.guest.lastName}
          </h4>
          <p className="text-xs text-[#707072]">📱 {order.guest.phone}</p>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="py-2.5 px-4 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-xs uppercase tracking-wider rounded-full flex items-center gap-2 transition-all shadow-md active:scale-95"
        >
          <MessageSquare className="w-4 h-4 fill-current" />
          <span>Contactar WhatsApp</span>
        </a>
      </div>

      {/* Order Items Table */}
      <div className="space-y-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#111111]">
          Detalle de Productos Solicitados ({order.items.length} líneas)
        </h3>
        <div className="border border-[#e5e5e5] bg-[#f5f5f5] divide-y divide-[#e5e5e5]">
          {order.items.map((item, idx) => (
            <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                {/* Product Image Thumbnail */}
                <button
                  type="button"
                  onClick={() => item.image && setPreviewImage({ url: item.image, name: item.name })}
                  disabled={!item.image}
                  className={`relative w-12 h-12 sm:w-14 sm:h-14 bg-white border border-[#e5e5e5] shrink-0 overflow-hidden flex items-center justify-center group ${
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
                        sizes="(max-width: 640px) 48px, 56px"
                        className="object-cover object-center group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <ZoomIn className="w-4 h-4 text-white drop-shadow-md" />
                      </div>
                    </>
                  ) : (
                    <ShoppingBag className="w-5 h-5 text-[#707072]" />
                  )}
                </button>

                {/* Product Info */}
                <div className="min-w-0">
                  <h5 className="font-bold text-[#111111] truncate">{item.name}</h5>
                  <p className="text-[#707072] mt-0.5">
                    {(item.variantLabel || item.variantName) && (
                      <>
                        Variante: <strong className="text-[#111111]">{item.variantLabel || item.variantName}</strong> •{' '}
                      </>
                    )}
                    Cantidad: <strong className="text-[#111111]">{item.qty}</strong>
                    {item.appliedPriceType && (
                      <span
                        className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.appliedPriceType === 'wholesale'
                            ? 'bg-[#007d48]/10 text-[#007d48]'
                            : item.appliedPriceType === 'custom'
                            ? 'bg-[#f59e0b]/10 text-[#f59e0b]'
                            : 'bg-[#f5f5f5] text-[#707072]'
                        }`}
                      >
                        {PRICE_TYPE_LABELS[item.appliedPriceType]}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Subtotal & Unit Price */}
              <div className="text-right font-extrabold text-[#111111] shrink-0">
                {formatPrice(item.subtotal)}
                <span className="block text-[10px] font-medium text-[#707072]">
                  {formatPrice(item.unitPrice)} c/u
                </span>
              </div>
            </div>
          ))}

          <div className="p-4 bg-white space-y-1">
            {order.discount > 0 && (
              <div className="flex justify-between text-xs text-[#707072]">
                <span>Subtotal</span><span>{formatPrice(order.subtotal)}</span>
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex justify-between text-xs text-[#007d48] font-semibold">
                <span>Descuento</span><span>-{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm font-extrabold text-[#111111]">
              <span>TOTAL DE LA VENTA:</span>
              <span className="text-xl">{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment & Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-3 bg-[#f5f5f5] border border-[#e5e5e5]">
          <span className="text-[10px] font-bold text-[#707072] uppercase tracking-wider block">
            MEDIO DE PAGO
          </span>
          <span className="font-extrabold text-[#111111] uppercase">
            {order.paymentMethod}
          </span>
        </div>

        <div className="p-3 bg-[#f5f5f5] border border-[#e5e5e5]">
          <span className="text-[10px] font-bold text-[#707072] uppercase tracking-wider block">
            NOTAS ADICIONALES
          </span>
          <span className="font-medium text-[#111111]">
            {order.notes || <span className="italic text-gray-400">Sin observaciones</span>}
          </span>
        </div>
      </div>

      {/* Authorize Payment Method Selector (only for pending) */}
      {isPending && (
        <div className="p-4 bg-[#007d48]/5 border border-[#007d48]/20 space-y-2">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111]">
            Medio de pago a registrar al autorizar
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full bg-white text-[#111111] text-xs font-bold py-2 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#007d48] cursor-pointer"
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      )}

      {/* Status Actions */}
      {!isFinalized && (
        <div className="pt-4 border-t border-[#e5e5e5] flex flex-wrap gap-2 justify-end">
          {isPending && (
            <button
              onClick={() => onEdit(order)}
              disabled={updating}
              className="py-3 px-5 bg-[#f5f5f5] hover:bg-[#e5e5e5] text-[#111111] font-bold text-xs uppercase tracking-wider rounded-full flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Editar Pedido</span>
            </button>
          )}

          {isPending && (
            <button
              onClick={handleAuthorize}
              disabled={updating}
              className="py-3 px-5 bg-[#007d48] hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-full flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>Autorizar Venta</span>
            </button>
          )}

          <button
            onClick={handleCancel}
            disabled={updating}
            className="py-3 px-5 bg-[#d30005] hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-full flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            <span>Cancelar Solicitud</span>
          </button>
        </div>
      )}

      {isFinalized && (
        <div className="pt-4 border-t border-[#e5e5e5] flex justify-end">
          <button
            onClick={onClose}
            className="py-3 px-6 bg-[#f5f5f5] text-[#111111] font-bold text-xs uppercase tracking-wider rounded-full flex items-center gap-2 cursor-pointer hover:bg-[#e5e5e5]"
          >
            <Check className="w-4 h-4" /> Cerrar
          </button>
        </div>
      )}
      {/* Image Preview Lightbox Modal */}
      <ResponsiveModal
        open={previewImage !== null}
        onOpenChange={(open) => !open && setPreviewImage(null)}
        title={previewImage?.name ?? 'Vista previa'}
        className="max-w-lg p-4 sm:p-6 gap-4"
      >
        {previewImage && (
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
        )}
      </ResponsiveModal>
    </ResponsiveModal>
  );
};
