"use client";

import React, { useState } from "react";
import { User, Phone, ShieldCheck } from "lucide-react";

export interface CustomerFormData {
  name: string;
  lastName: string;
  phone: string;
}

/**
 * Validates that a WhatsApp cell phone has exactly 10 numeric digits,
 * with no spaces, '+', 'e', or special symbols.
 */
export function validateWhatsAppPhone(phone: string): string | undefined {
  if (!phone || phone.length === 0) {
    return "El teléfono de WhatsApp es obligatorio";
  }
  if (!/^\d+$/.test(phone)) {
    return "Ingresá solo números (sin espacios, + ni símbolos especiales)";
  }
  if (phone.length !== 10) {
    return "El teléfono debe tener exactamente 10 dígitos numéricos (sin 0 ni 15)";
  }
  return undefined;
}

interface Step1CustomerDataProps {
  initialData: CustomerFormData;
  onSubmit: (data: CustomerFormData) => void;
}

export const Step1CustomerData: React.FC<Step1CustomerDataProps> = ({
  initialData,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<CustomerFormData>(initialData);
  const [errors, setErrors] = useState<{
    name?: string;
    lastName?: string;
    phone?: string;
  }>({});

  const validate = () => {
    const errs: { name?: string; lastName?: string; phone?: string } = {};

    if (!formData.name.trim()) {
      errs.name = "El nombre es obligatorio";
    }
    if (!formData.lastName.trim()) {
      errs.lastName = "El apellido es obligatorio";
    }
    const phoneError = validateWhatsAppPhone(formData.phone);
    if (phoneError) {
      errs.phone = phoneError;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <form
      id="checkout-step1-form"
      onSubmit={handleSubmit}
      className="space-y-6 p-0.5"
    >
      <div className="space-y-1">
        <h3 className="text-xl font-extrabold uppercase tracking-tight text-[#111111]">
          Tus Datos de Contacto
        </h3>
        <p className="text-xs text-[#707072]">
          Ingresá tus datos para enviarte la confirmación del pedido por
          WhatsApp.
        </p>
      </div>

      <div className="space-y-4">
        {/* Nombre & Apellido */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
              Nombre *
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className={`w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-3 pl-10 pr-4 rounded-none border focus:outline-none focus:ring-2 focus:ring-[#111111] ${
                  errors.name ? "border-[#d30005]" : "border-[#e5e5e5]"
                }`}
              />
              <User className="w-4 h-4 text-[#707072] absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            {errors.name && (
              <p className="text-[11px] text-[#d30005] font-semibold mt-1">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
              Apellido *
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                className={`w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-3 pl-10 pr-4 rounded-none border focus:outline-none focus:ring-2 focus:ring-[#111111] ${
                  errors.lastName ? "border-[#d30005]" : "border-[#e5e5e5]"
                }`}
              />
              <User className="w-4 h-4 text-[#707072] absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            {errors.lastName && (
              <p className="text-[11px] text-[#d30005] font-semibold mt-1">
                {errors.lastName}
              </p>
            )}
          </div>
        </div>

        {/* Teléfono WhatsApp */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
            Teléfono celular (WhatsApp) *
          </label>
          <div className="relative">
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Ej: 3815218630 (10 dígitos, sin 0 ni 15)"
              value={formData.phone}
              onChange={(e) => {
                const nextPhone = e.target.value;
                setFormData({ ...formData, phone: nextPhone });
                setErrors((prev) => ({
                  ...prev,
                  phone: validateWhatsAppPhone(nextPhone),
                }));
              }}
              className={`w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-3 pl-10 pr-4 rounded-none border focus:outline-none focus:ring-2 focus:ring-[#111111] ${
                errors.phone ? "border-[#d30005]" : "border-[#e5e5e5]"
              }`}
            />
            <Phone className="w-4 h-4 text-[#707072] absolute left-3.5 top-1/2 -translate-y-1/2" />
          </div>
          {errors.phone ? (
            <p className="text-[11px] text-[#d30005] font-semibold mt-1">
              {errors.phone}
            </p>
          ) : (
            <p className="text-[11px] text-[#707072] mt-1">
              Ingresá 10 números seguidos sin 0, sin 15 y sin símbolos ({formData.phone.length}/10 dígitos).
            </p>
          )}
        </div>
      </div>

      {/* Security Callout */}
      <div className="p-3 bg-[#f5f5f5] border border-[#e5e5e5] flex items-center gap-3 text-xs text-[#707072]">
        <ShieldCheck className="w-5 h-5 text-[#007d48] flex-shrink-0" />
        <span>
          Tus datos están protegidos. No requiere registro ni contraseña.
        </span>
      </div>
    </form>
  );
};
