"use client";

import React, { useState } from "react";
import Image from "next/image";
import { CustomerFormData } from "./Step1CustomerData";
import { useCart, CartItem } from "@/context/CartContext";
import { Check, Edit, AlertCircle, Loader2, Zap } from "lucide-react";
import { formatPrice } from "@/utils/formatCurrency";

interface Step2OrderReviewProps {
  customerData: CustomerFormData;
  items: CartItem[];
  subtotal: number;
  onEditCustomer: () => void;
  onConfirmOrder: (
    paymentMethod: "transferencia" | "efectivo",
    notes?: string,
  ) => Promise<void>;
}

export const Step2OrderReview: React.FC<Step2OrderReviewProps> = ({
  customerData,
  items,
  subtotal,
  onEditCustomer,
  onConfirmOrder,
}) => {
  const { isWholesale, getEffectivePrice } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<
    "transferencia" | "efectivo"
  >("transferencia");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleConfirm = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      await onConfirmOrder(paymentMethod, notes);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error al procesar el pedido",
      );
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-xl font-extrabold uppercase tracking-tight text-[#111111]">
          Revisá tu pedido
        </h3>
        <p className="text-xs text-[#707072]">
          Verificá el desglose de productos y tus datos antes de confirmar la
          compra.
        </p>
      </div>

      {/* 1. Items List Review */}
      <div className="border border-[#e5e5e5] bg-[#f5f5f5] divide-y divide-[#e5e5e5]">
        {items.map((item) => {
          const effectivePrice = getEffectivePrice(item);
          const isDiscounted =
            isWholesale && item.wholesalePrice < item.retailPrice;

          return (
            <div
              key={`${item.productId}-${item.variantId || item.variantName || 'default'}`}
              className="p-3.5 flex gap-4 items-center"
            >
              <div className="relative w-14 h-14 bg-white flex-shrink-0 border border-[#e5e5e5]">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="56px"
                    className="object-cover object-center"
                  />
                ) : (
                  <div className="w-full h-full bg-[#f5f5f5]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-xs text-[#111111] truncate">
                  {item.name}
                </h4>
                <p className="text-[11px] text-[#707072]">
                  {item.variantLabel || item.variantName ? (
                    <>Variante: <strong className="text-[#111111]">{item.variantLabel || item.variantName}</strong> • </>
                  ) : null}
                  Cantidad: <strong className="text-[#111111]">{item.qty}</strong>
                </p>
                {isDiscounted ? (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs font-extrabold text-[#007d48]">
                      {formatPrice(effectivePrice * item.qty)}
                    </span>
                    <span className="text-[11px] font-semibold text-[#707072] line-through">
                      {formatPrice(item.retailPrice * item.qty)}
                    </span>
                    <span className="text-[10px] font-bold text-[#007d48] bg-[#007d48]/10 px-1.5 py-0.5 rounded-sm flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5 fill-current" />
                      Promoción mayorista
                    </span>
                  </div>
                ) : (
                  <p className="text-xs font-extrabold text-[#111111] mt-0.5">
                    {formatPrice(item.retailPrice * item.qty)}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Subtotal & Total Row */}
        <div className="p-4 bg-white flex justify-between items-center text-sm font-extrabold text-[#111111]">
          <span>Total a pagar:</span>
          <span className="text-xl">{formatPrice(subtotal)}</span>
        </div>
      </div>

      {/* 2. Customer Summary Card */}
      <div className="p-4 bg-[#f5f5f5] border border-[#e5e5e5] flex justify-between items-center">
        <div>
          <span className="text-[10px] font-bold text-[#707072] uppercase tracking-wider block mb-0.5">
            Te lo enviamos / Contactamos a:
          </span>
          <p className="font-bold text-xs text-[#111111]">
            {customerData.name} {customerData.lastName} • {customerData.phone}
          </p>
        </div>
        <button
          onClick={onEditCustomer}
          className="text-xs font-bold text-[#111111] underline hover:text-[#707072] flex items-center gap-1"
        >
          <Edit className="w-3.5 h-3.5" /> Editar
        </button>
      </div>

      {/* 3. Payment Method Choice */}
      <div>
        <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-2">
          Medio de pago preferido
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod("transferencia")}
            className={`p-3 text-left border font-semibold text-xs transition-all ${
              paymentMethod === "transferencia"
                ? "border-[#111111] bg-[#111111] text-white"
                : "border-[#e5e5e5] bg-white text-[#111111] hover:border-[#111111]"
            }`}
          >
            <div className="font-bold">Transferencia Bancaria</div>
            <div className="text-[10px] opacity-80 mt-0.5">
              CBU / Alias (Recomendado)
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod("efectivo")}
            className={`p-3 text-left border font-semibold text-xs transition-all ${
              paymentMethod === "efectivo"
                ? "border-[#111111] bg-[#111111] text-white"
                : "border-[#e5e5e5] bg-white text-[#111111] hover:border-[#111111]"
            }`}
          >
            <div className="font-bold">Efectivo</div>
            <div className="text-[10px] opacity-80 mt-0.5">
              Pago en mano al retirar
            </div>
          </button>
        </div>
      </div>

      {/* Optional Note */}
      <div>
        <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
          Notas adicionales (opcional)
        </label>
        <input
          type="text"
          placeholder="Ej: Horarios de preferencia para retirar"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-medium py-2.5 px-3 rounded-none border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
        />
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 bg-[#d30005]/10 border border-[#d30005] text-[#d30005] text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="w-full py-4 bg-[#111111] hover:bg-black text-white font-bold text-sm uppercase tracking-wider rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md disabled:opacity-50 cursor-pointer"
      >
        <>
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Check className="w-5 h-5" />
          )}
          Confirmar Pedido
        </>
      </button>
    </div>
  );
};
