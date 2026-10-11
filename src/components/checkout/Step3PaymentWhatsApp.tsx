'use client';

import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, MessageSquare, Clock } from 'lucide-react';
import { buildWhatsAppShareUrl } from '@/utils/whatsapp';
import { useSettings } from '@/context/SettingsContext';
import { formatPrice, formatAmount } from '@/utils/formatCurrency';

interface Step3PaymentWhatsAppProps {
  orderNumber: string;
  total: number;
  customer: {
    name: string;
    lastName: string;
    phone: string;
  };
  items: Array<{
    name: string;
    variantName?: string;
    size?: number;
    qty: number;
    price: number;
    subtotal: number;
  }>;
  onFinish: () => void;
}

export const Step3PaymentWhatsApp: React.FC<Step3PaymentWhatsAppProps> = ({
  orderNumber,
  total,
  customer,
  items,
  onFinish,
}) => {
  const [copiedAlias, setCopiedAlias] = useState(false);
  const [copiedCbu, setCopiedCbu] = useState(false);
  const [copiedTotal, setCopiedTotal] = useState(false);

  const { settings } = useSettings();

  const whatsappUrl = buildWhatsAppShareUrl({
    orderNumber,
    guest: customer,
    items,
    total,
    storePhone: settings.storePhone,
    bankAlias: settings.bankAlias,
  });

  const handleCopyAlias = () => {
    navigator.clipboard.writeText(settings.bankAlias);
    setCopiedAlias(true);
    setTimeout(() => setCopiedAlias(false), 2000);
  };

  const handleCopyCbu = () => {
    if (!settings.bankCbu) return;
    navigator.clipboard.writeText(settings.bankCbu);
    setCopiedCbu(true);
    setTimeout(() => setCopiedCbu(false), 2000);
  };

  const handleCopyTotal = () => {
    navigator.clipboard.writeText(total.toString());
    setCopiedTotal(true);
    setTimeout(() => setCopiedTotal(false), 2000);
  };

  return (
    <div className="space-y-6 text-[#111111]">
      {/* Success Registered Banner */}
      <div className="bg-[#f5f5f5] p-4 border-l-4 border-[#007d48] flex items-center gap-3">
        <CheckCircle2 className="w-8 h-8 text-[#007d48] flex-shrink-0" />
        <div>
          <h3 className="font-extrabold text-base uppercase tracking-tight text-[#111111]">
            Pedido Registrado
          </h3>
          <p className="text-xs text-[#707072] font-semibold">
            Solicitud <strong className="text-[#111111]">#{orderNumber}</strong> guardada exitosamente.
          </p>
        </div>
      </div>

      {/* Instructions Box */}
      <div className="space-y-1">
        <h4 className="text-sm font-extrabold uppercase tracking-wider text-[#111111]">
          ¡Último paso!
        </h4>
        <p className="text-xs text-[#707072]">
          Realizá la transferencia a los siguientes datos y envianos el comprobante por WhatsApp para confirmar la venta.
        </p>
      </div>

      {/* Bank Details Box */}
      <div className="bg-[#f5f5f5] border border-[#e5e5e5] p-5 space-y-4 font-sans">
        <div className="border-b border-[#e5e5e5] pb-3 flex justify-between items-start">
          <div>
            <span className="text-[10px] font-bold text-[#707072] uppercase tracking-wider block">
              ALIAS BANCARIO
            </span>
            <span className="text-base font-extrabold text-[#111111]">{settings.bankAlias}</span>
          </div>
          <button
            onClick={handleCopyAlias}
            className="px-3 py-1.5 bg-white text-[#111111] text-xs font-bold border border-[#e5e5e5] hover:border-[#111111] transition-all flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
          >
            {copiedAlias ? <Check className="w-3.5 h-3.5 text-[#007d48]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAlias ? '¡Copiado!' : 'Copiar Alias'}</span>
          </button>
        </div>

        {/* Optional CBU / CVU */}
        {settings.bankCbu && (
          <div className="border-b border-[#e5e5e5] pb-3 flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-[#707072] uppercase tracking-wider block">
                CBU / CVU
              </span>
              <span className="text-sm font-bold text-[#111111] break-all">{settings.bankCbu}</span>
            </div>
            <button
              onClick={handleCopyCbu}
              className="px-3 py-1.5 bg-white text-[#111111] text-xs font-bold border border-[#e5e5e5] hover:border-[#111111] transition-all flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
            >
              {copiedCbu ? <Check className="w-3.5 h-3.5 text-[#007d48]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCbu ? '¡Copiado!' : 'Copiar CBU'}</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold text-[#707072] uppercase tracking-wider block">
              TITULAR DE CUENTA
            </span>
            <span className="font-bold text-[#111111]">{settings.bankHolder}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#707072] uppercase tracking-wider block">
              BANCO / ENTIDAD
            </span>
            <span className="font-bold text-[#111111]">{settings.bankName}</span>
          </div>
          {settings.bankCuit && (
            <div>
              <span className="text-[10px] font-bold text-[#707072] uppercase tracking-wider block">
                CUIT / CUIL
              </span>
              <span className="font-bold text-[#111111]">{settings.bankCuit}</span>
            </div>
          )}
        </div>

        <div className="border-t border-[#e5e5e5] pt-3 flex justify-between items-center bg-white p-3">
          <div>
            <span className="text-[10px] font-bold text-[#707072] uppercase tracking-wider block">
              MONTO EXACTO A TRANSFERIR
            </span>
            <span className="text-xl font-extrabold text-[#111111]">
              {formatPrice(total)}
            </span>
          </div>
          <button
            onClick={handleCopyTotal}
            className="px-3 py-1.5 bg-[#f5f5f5] text-[#111111] text-xs font-bold border border-[#e5e5e5] hover:border-[#111111] transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            {copiedTotal ? <Check className="w-3.5 h-3.5 text-[#007d48]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedTotal ? '¡Copiado!' : 'Copiar Monto'}</span>
          </button>
        </div>
      </div>

      {/* Business Hours Callout */}
      <div className="flex items-center gap-2 text-xs text-[#707072] bg-[#f5f5f5] p-3 border border-[#e5e5e5]">
        <Clock className="w-4 h-4 text-[#111111]" />
        <span>Horario de atención WhatsApp: <strong>{settings.businessHours}</strong>.</span>
      </div>

      {/* GREEN BUTTON: Enviar resumen a WhatsApp */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onFinish}
        className="w-full py-4 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-white font-extrabold text-base tracking-tight flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-[#22c55e]/30 cursor-pointer"
      >
        <MessageSquare className="w-6 h-6 fill-current text-white" />
        <div className="flex flex-col items-start leading-tight">
          <span className="text-base font-extrabold">Enviar resumen del pedido</span>
          <span className="text-xs font-medium opacity-90">Adjuntá tu comprobante de pago por WhatsApp</span>
        </div>
      </a>
    </div>
  );
};
