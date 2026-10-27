"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Phone, ShieldCheck, Truck, Clock, Globe } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useStoreCategories } from "@/hooks/useStoreCategories";
import { categoryHref } from "@/lib/categoryTree";

const FOOTER_LINK_CLASS =
  "hover:text-[#f5f5f5] hover:underline underline-offset-4 transition-colors";

export const Footer: React.FC = () => {
  const { settings } = useSettings();
  const categoryTree = useStoreCategories();

  const cleanPhone = settings.storePhone.replace(/[^0-9]/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(settings.whatsappInquiryMessage)}`;

  return (
    <footer className="bg-[#111111] border-t border-[#27272a] text-[#f5f5f5] mt-16">
      {/* 1. Value Propositions Banner */}
      <div className="bg-[#18181b] py-8 border-b border-[#27272a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-4">
            <div className="p-3 bg-[#111111] rounded-full shadow-sm text-[#f5f5f5]">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm uppercase tracking-tight">
                Envíos a todo el País
              </h4>
              <p className="text-xs text-[#a1a1aa]">
                {settings.shippingInfo || "Despachamos tu pedido en 24hs"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-4">
            <div className="p-3 bg-[#111111] rounded-full shadow-sm text-[#34d399]">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm uppercase tracking-tight">
                Atención Directa
              </h4>
              <p className="text-xs text-[#a1a1aa]">
                Confirmación rápida por WhatsApp
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-4">
            <div className="p-3 bg-[#111111] rounded-full shadow-sm text-[#f5f5f5]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm uppercase tracking-tight">
                Calidad Garantizada
              </h4>
              <p className="text-xs text-[#a1a1aa]">
                Productos 100% verificados
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Footer Columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
        <div className="space-y-3">
          <Link href="/" className="inline-block mb-1">
            <Image
              src="/logotipo.png"
              alt={settings.storeName || "The Point"}
              width={140}
              height={110}
              className="h-14 w-auto object-contain hover:opacity-85 transition-opacity"
            />
          </Link>
          <p className="text-xs text-[#a1a1aa] leading-relaxed mb-4">
            {settings.footerDescription ||
              "Perfumería de lujo y fragancias de autor. Seleccioná tus aromas favoritos y completá tu pedido de forma fácil y directa vía WhatsApp."}
          </p>
          <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
            <Clock className="w-4 h-4 text-[#f5f5f5]" />
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
                  className="p-2 bg-[#18181b] text-[#f5f5f5] hover:bg-[#f5f5f5] hover:text-[#111111] rounded-full transition-colors"
                  aria-label="Instagram"
                  title="Instagram"
                >
                  <Globe className="w-4 h-4 text-pink-400" />
                </a>
              )}
              {settings.facebookUrl && (
                <a
                  href={settings.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-[#18181b] text-[#f5f5f5] hover:bg-[#f5f5f5] hover:text-[#111111] rounded-full transition-colors"
                  aria-label="Facebook"
                  title="Facebook"
                >
                  <Globe className="w-4 h-4 text-blue-400" />
                </a>
              )}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f5f5f5] mb-5">
            Categorías
          </h4>
          <ul className="space-y-2 text-xs text-[#a1a1aa]">
            <li>
              <Link href="/#catalogo" className={FOOTER_LINK_CLASS}>
                Todos los productos
              </Link>
            </li>

            {categoryTree.map((category) => (
              <li key={category._id}>
                <Link href={categoryHref(category)} className={FOOTER_LINK_CLASS}>
                  {category.name}
                </Link>

                {category.children.length > 0 && (
                  <ul className="mt-2 ml-1 space-y-2 border-l border-[#27272a] pl-3">
                    {category.children.map((child) => (
                      <li key={child._id}>
                        <Link href={categoryHref(child)} className={FOOTER_LINK_CLASS}>
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}

            <li>
              <Link href="/?clearance=true#catalogo" className={FOOTER_LINK_CLASS}>
                Ofertas
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f5f5f5] mb-5">
            Medios de Pago
          </h4>
          <ul className="space-y-2 text-xs text-[#a1a1aa]">
            <li>• Transferencia Bancaria (CBU / Alias)</li>
            <li>• Pago en Efectivo (Contra entrega)</li>
            {/* <li>
              • Precios Mayoristas (desde {settings.wholesaleMinPairs} unidades)
            </li> */}
          </ul>
        </div>

        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f5f5f5] mb-5">
            Contacto Directo
          </h4>
          <p className="text-xs text-[#a1a1aa] mb-3">
            ¿Tenés alguna duda sobre alguna fragancia o producto?
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#f5f5f5] text-[#111111] text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-white/90 transition-transform active:scale-95 shadow-sm cursor-pointer"
          >
            <Phone className="w-4 h-4 text-[#34d399]" />
            <span>Hablar por WhatsApp</span>
          </a>
        </div>
      </div>

      {/* 3. Bottom Legal Row */}
      <div className="border-t border-[#27272a] py-6 bg-[#18181b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-[#a1a1aa] uppercase font-semibold tracking-widest">
          <p>
            © {new Date().getFullYear()} {settings.storeName}. Todos los
            derechos reservados.
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {/* <span>Términos y Condiciones</span>
            <span>Políticas de Privacidad</span>
            <span>Catálogo E-Commerce</span> */}
          </div>
        </div>
      </div>
    </footer>
  );
};
