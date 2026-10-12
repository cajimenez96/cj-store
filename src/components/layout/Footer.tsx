'use client';

import React from 'react';
import Link from 'next/link';
import { Phone, ShieldCheck, Truck, Clock, Globe } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';

export const Footer: React.FC = () => {
  const { settings } = useSettings();

  const cleanPhone = settings.storePhone.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(settings.whatsappInquiryMessage)}`;

  return (
    <footer className="bg-white border-t border-[#cacacb] text-[#111111] mt-16">
      {/* 1. Value Propositions Banner */}
      <div className="bg-[#f5f5f5] py-8 border-b border-[#e5e5e5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-4">
            <div className="p-3 bg-white rounded-full shadow-sm text-[#111111]">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm uppercase tracking-tight">
                Envíos a todo el País
              </h4>
              <p className="text-xs text-[#707072]">
                {settings.shippingInfo || 'Despachamos tu pedido en 24hs'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-4">
            <div className="p-3 bg-white rounded-full shadow-sm text-[#007d48]">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm uppercase tracking-tight">
                Atención Directa
              </h4>
              <p className="text-xs text-[#707072]">
                Confirmación rápida por WhatsApp
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-4">
            <div className="p-3 bg-white rounded-full shadow-sm text-[#111111]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm uppercase tracking-tight">
                Calidad Garantizada
              </h4>
              <p className="text-xs text-[#707072]">
                Productos 100% verificados
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Footer Columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <h3 className="font-extrabold text-xl tracking-tighter uppercase mb-3">
            {settings.storeName || "The Point"}
          </h3>
          <p className="text-xs text-[#707072] leading-relaxed mb-4">
            {settings.footerDescription ||
              "Perfumería de lujo y fragancias de autor. Seleccioná tus aromas favoritos y completá tu pedido de forma fácil y directa vía WhatsApp."}
          </p>
          <div className="flex items-center gap-2 text-xs text-[#707072]">
            <Clock className="w-4 h-4 text-[#111111]" />
            <span>Horarios: {settings.businessHours}</span>
          </div>

          {/* Social Links if present */}
          {(settings.instagramUrl || settings.facebookUrl) && (
            <div className="flex items-center gap-3 mt-4">
              {settings.instagramUrl && (
                <a
                  href={settings.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-[#f5f5f5] text-[#111111] hover:bg-[#111111] hover:text-white rounded-full transition-colors"
                  aria-label="Instagram"
                  title="Instagram"
                >
                  <Globe className="w-4 h-4 text-pink-600" />
                </a>
              )}
              {settings.facebookUrl && (
                <a
                  href={settings.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-[#f5f5f5] text-[#111111] hover:bg-[#111111] hover:text-white rounded-full transition-colors"
                  aria-label="Facebook"
                  title="Facebook"
                >
                  <Globe className="w-4 h-4 text-blue-600" />
                </a>
              )}
            </div>
          )}
        </div>

        <div>
          <h4 className="font-bold text-sm uppercase tracking-wider mb-4">
            Fragancias
          </h4>
          <ul className="space-y-2 text-xs text-[#707072]">
            <li>
              <Link
                href="/?gender=Hombre#catalogo"
                className="hover:text-[#111111] transition-colors"
              >
                Fragancias Hombre
              </Link>
            </li>
            <li>
              <Link
                href="/?gender=Mujer#catalogo"
                className="hover:text-[#111111] transition-colors"
              >
                Fragancias Mujer
              </Link>
            </li>
            <li>
              <Link
                href="/?gender=Unisex#catalogo"
                className="hover:text-[#111111] transition-colors"
              >
                Fragancias Unisex
              </Link>
            </li>
            <li>
              <Link
                href="/#catalogo"
                className="hover:text-[#111111] transition-colors"
              >
                Accesorios & Diseños
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-sm uppercase tracking-wider mb-4">
            Medios de Pago
          </h4>
          <ul className="space-y-2 text-xs text-[#707072]">
            <li>• Transferencia Bancaria (CBU / Alias)</li>
            <li>• Pago en Efectivo (Contra entrega)</li>
            <li>• Precios Mayoristas (desde {settings.wholesaleMinPairs} unidades)</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-sm uppercase tracking-wider mb-4">
            Contacto Directo
          </h4>
          <p className="text-xs text-[#707072] mb-3">
            ¿Tenés alguna duda sobre alguna fragancia o producto?
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#111111] text-white text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-black/90 transition-transform active:scale-95 shadow-sm cursor-pointer"
          >
            <Phone className="w-4 h-4 text-[#007d48]" />
            <span>Hablar por WhatsApp</span>
          </a>
        </div>
      </div>

      {/* 3. Bottom Legal Row */}
      <div className="border-t border-[#e5e5e5] py-6 bg-[#f5f5f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-[#707072] uppercase font-medium">
          <p>© {new Date().getFullYear()} {settings.storeName}. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <span>Términos y Condiciones</span>
            <span>Políticas de Privacidad</span>
            <span>Catálogo E-Commerce</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
