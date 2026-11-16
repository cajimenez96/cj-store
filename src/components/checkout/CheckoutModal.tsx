'use client';

import React, { useState } from 'react';
import { ArrowRight, Check, Loader2, MessageSquare } from 'lucide-react';
import { Step1CustomerData, CustomerFormData } from './Step1CustomerData';
import { Step2OrderReview } from './Step2OrderReview';
import { Step3PaymentWhatsApp } from './Step3PaymentWhatsApp';
import { useCart } from '@/context/CartContext';
import { useSettings } from '@/context/SettingsContext';
import { buildWhatsAppShareUrl } from '@/utils/whatsapp';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose }) => {
  const { items, subtotal, clearCart, getEffectivePrice } = useCart();
  const { settings } = useSettings();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerFormData>({
    name: '',
    lastName: '',
    phone: '',
  });

  // Created Order Result Data for Step 3
  const [createdOrder, setCreatedOrder] = useState<{
    orderId: string;
    orderNumber: string;
    total: number;
  } | null>(null);

  const handleStep1Submit = (data: CustomerFormData) => {
    setCustomerData(data);
    setStep(2);
  };

  const handleConfirmOrder = async (
    paymentMethod: 'transferencia' | 'efectivo' | 'tarjeta',
    notes?: string
  ) => {
    setIsSubmittingOrder(true);
    try {
      const payload = {
        guest: customerData,
        paymentMethod,
        notes,
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          variantLabel: item.variantLabel,
          variantName: item.variantName,
          sku: item.sku,
          qty: item.qty,
        })),
      };

      const res = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.message || 'Error al procesar el pedido');
      }

      setCreatedOrder({
        orderId: json.orderId,
        orderNumber: json.orderNumber,
        total: json.total,
      });

      setStep(3);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleFinishCheckout = () => {
    clearCart();
    onClose();
    setStep(1);
    setCreatedOrder(null);
  };

  const formattedItemsForStep3 = items.map((item) => {
    const effectivePrice = getEffectivePrice(item);
    return {
      name: item.name,
      variantName: item.variantLabel || item.variantName,
      qty: item.qty,
      price: effectivePrice,
      subtotal: effectivePrice * item.qty,
    };
  });

  const whatsappUrl = createdOrder
    ? buildWhatsAppShareUrl({
        orderNumber: createdOrder.orderNumber,
        guest: customerData,
        items: formattedItemsForStep3,
        total: createdOrder.total,
        storePhone: settings.storePhone,
        bankAlias: settings.bankAlias,
      })
    : '';

  const checkoutFooter =
    step === 1 ? (
      <button
        type="submit"
        form="checkout-step1-form"
        className="w-full py-4 bg-[#111111] hover:bg-black text-white font-bold text-sm uppercase tracking-wider rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer"
      >
        <span>Continuar a Tu Pedido</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    ) : step === 2 ? (
      <button
        type="submit"
        form="checkout-step2-form"
        disabled={isSubmittingOrder}
        className="w-full py-4 bg-[#111111] hover:bg-black text-white font-bold text-sm uppercase tracking-wider rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md disabled:opacity-50 cursor-pointer"
      >
        {isSubmittingOrder ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Check className="w-5 h-5" />
        )}
        Confirmar Pedido
      </button>
    ) : step === 3 && createdOrder ? (
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleFinishCheckout}
        className="w-full py-4 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-white font-extrabold text-base tracking-tight flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-[#22c55e]/30 cursor-pointer"
      >
        <MessageSquare className="w-6 h-6 fill-current text-white" />
        <div className="flex flex-col items-start leading-tight">
          <span className="text-base font-extrabold">Enviar resumen del pedido</span>
          <span className="text-xs font-medium opacity-90">Adjuntá tu comprobante de pago por WhatsApp</span>
        </div>
      </a>
    ) : undefined;

  return (
    <ResponsiveModal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Finalizar compra"
      hideTitle
      className="sm:max-w-2xl p-6 sm:p-8 gap-6"
      footer={checkoutFooter}
    >
      {/* Stepper Indicator Header (Epicodes Style 1 - 2 - 3) */}
      <div className="flex items-center justify-between max-w-md mx-auto py-2 border-b border-[#f5f5f5]">
        {/* Step 1 */}
        <div className="flex flex-col items-center gap-1">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs transition-all ${
              step >= 1
                ? 'bg-[#111111] text-white shadow-xs'
                : 'bg-[#f5f5f5] text-[#707072]'
            }`}
          >
            {step > 1 ? <Check className="w-4 h-4" /> : 1}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#111111]">
            Tus Datos
          </span>
        </div>

        <div
          className={`flex-1 h-[2px] mx-2 transition-all ${
            step >= 2 ? 'bg-[#111111]' : 'bg-[#e5e5e5]'
          }`}
        />

        {/* Step 2 */}
        <div className="flex flex-col items-center gap-1">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs transition-all ${
              step >= 2
                ? 'bg-[#111111] text-white shadow-xs'
                : 'bg-[#f5f5f5] text-[#707072]'
            }`}
          >
            {step > 2 ? <Check className="w-4 h-4" /> : 2}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#111111]">
            Tu Pedido
          </span>
        </div>

        <div
          className={`flex-1 h-[2px] mx-2 transition-all ${
            step >= 3 ? 'bg-[#111111]' : 'bg-[#e5e5e5]'
          }`}
        />

        {/* Step 3 */}
        <div className="flex flex-col items-center gap-1">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs transition-all ${
              step === 3
                ? 'bg-[#007d48] text-white shadow-xs'
                : 'bg-[#f5f5f5] text-[#707072]'
            }`}
          >
            3
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#111111]">
            Pago
          </span>
        </div>
      </div>

      {/* Step Views */}
      {step === 1 && (
        <Step1CustomerData
          initialData={customerData}
          onSubmit={handleStep1Submit}
        />
      )}

      {step === 2 && (
        <Step2OrderReview
          customerData={customerData}
          items={items}
          subtotal={subtotal}
          onEditCustomer={() => setStep(1)}
          onConfirmOrder={handleConfirmOrder}
        />
      )}

      {step === 3 && createdOrder && (
        <Step3PaymentWhatsApp
          orderNumber={createdOrder.orderNumber}
          total={createdOrder.total}
        />
      )}
    </ResponsiveModal>
  );
};
