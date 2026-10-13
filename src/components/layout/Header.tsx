"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, Menu, X, Phone } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useSettings } from "@/context/SettingsContext";
import { SearchBar } from "@/components/common/SearchBar";
import Image from "next/image";

interface HeaderProps {
  onSearchChange?: (term: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onSearchChange }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [topBarWhatsappUrl, setTopBarWhatsappUrl] = useState("");
  const [formattedPhone, setFormattedPhone] = useState("");
  const { totalItems, openCart } = useCart();
  const { settings, formatPhoneNumber } = useSettings();

  useEffect(() => {
    if (settings.storePhone) {
      const cleanPhone = settings.storePhone.replace(/[^0-9]/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(settings.whatsappInquiryMessage)}`;
      setTopBarWhatsappUrl(url);
      setFormattedPhone(formatPhoneNumber(settings.storePhone));
    }
  }, [settings.storePhone, settings.whatsappInquiryMessage, formatPhoneNumber]);

  const navLinks = [
    { label: "Catálogo", href: "/#catalogo" },
    ...(settings.enableGenders !== false
      ? [
          { label: "Hombre", href: "/?gender=Hombre#catalogo" },
          { label: "Mujer", href: "/?gender=Mujer#catalogo" },
          { label: "Unisex", href: "/?gender=Unisex#catalogo" },
        ]
      : []),
    { label: "🔥 Ofertas", href: "/?clearance=true#catalogo", isClearance: true },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#e5e5e5]">
      {/* 1. Utility Top Bar with dynamic Settings */}
      <div className="bg-[#f5f5f5] text-[#111111] text-xs py-1.5 px-4 sm:px-8 flex justify-between items-center font-medium border-b border-[#e5e5e5]">
        <a
          href={topBarWhatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <Phone className="w-3.5 h-3.5 text-[#007d48]" />
          <span>
            Atención WhatsApp: <strong>{formattedPhone || '-'}</strong>
          </span>
        </a>
        <div className="hidden md:flex gap-4 text-[#707072]">
          <span>{settings.shippingInfo || 'Envíos a todo el país en 24/48hs'}</span>
          <span>•</span>
          <span>Fragancias 100% Originales</span>
        </div>
      </div>

      {/* 2. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile Menu Trigger + Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-full hover:bg-[#f5f5f5] transition-colors cursor-pointer"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>

          <Link href="/" className="flex items-center gap-2 group cursor-pointer py-1">
            <Image
              src="/logo-nav.png"
              alt={settings.storeName || "The Point"}
              width={180}
              height={32}
              priority
              className="h-8 sm:h-9 w-auto object-contain group-hover:opacity-85 transition-opacity"
            />
          </Link>
        </div>

        {/* Center: Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#111111]">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`py-1 relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] hover:after:w-full after:transition-all cursor-pointer ${
                link.isClearance
                  ? 'text-[#d30005] font-extrabold hover:text-red-700 after:bg-[#d30005]'
                  : 'hover:text-[#707072] text-[#111111] after:bg-[#111111]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right: Search Pill & Cart Icon */}
        <div className="flex items-center gap-3">
          {/* Search Pill */}
          <SearchBar
            onSearchChange={onSearchChange}
            placeholder="Buscar perfumes, fragancias..."
            className="hidden sm:block w-52 md:w-64"
          />

          {/* Cart Button */}
          <button
            onClick={openCart}
            className="relative p-2.5 rounded-full bg-[#111111] text-white hover:bg-black/90 transition-transform active:scale-95 flex items-center justify-center shadow-sm cursor-pointer"
            aria-label="Ver Carrito"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#d30005] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#e5e5e5] px-6 py-4 space-y-4 animate-in slide-in-from-top duration-200">
          <SearchBar
            onSearchChange={onSearchChange}
            placeholder="Buscar perfumes, fragancias..."
            className="w-full"
            inputClassName="text-sm py-2.5 pl-10 pr-8"
          />

          <nav className="flex flex-col space-y-3 font-semibold text-base">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`py-1.5 border-b border-[#f5f5f5] cursor-pointer ${
                  link.isClearance
                    ? 'text-[#d30005] font-extrabold'
                    : 'text-[#111111] hover:text-[#707072]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};
