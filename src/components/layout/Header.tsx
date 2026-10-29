"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, Menu, X, Phone } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useSettings } from "@/context/SettingsContext";
import { SearchBar } from "@/components/common/SearchBar";
import { useStoreCategories } from "@/hooks/useStoreCategories";
import { categoryHref } from "@/lib/categoryTree";
import Image from "next/image";

interface HeaderProps {
  onSearchChange?: (term: string) => void;
}

// Rubros shown in the desktop bar; the footer and the filters list every category
const MAX_HEADER_CATEGORIES = 6;

const NAV_ITEM_CLASS =
  "px-3 py-1.5 rounded-full transition-all whitespace-nowrap cursor-pointer text-[#f5f5f5] hover:bg-[#f5f5f5] hover:text-[#111111]";
const NAV_OFFERS_CLASS =
  "px-3 py-1.5 rounded-full transition-all whitespace-nowrap cursor-pointer text-[#d30005] hover:bg-[#d30005]/10";

export const Header: React.FC<HeaderProps> = ({ onSearchChange }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [topBarWhatsappUrl, setTopBarWhatsappUrl] = useState("");
  const [formattedPhone, setFormattedPhone] = useState("");
  const { totalItems, openCart } = useCart();
  const { settings, formatPhoneNumber } = useSettings();

  useEffect(() => {
    if (settings.storePhone) {
      const cleanPhone = settings.storePhone.replace(/[^0-9]/g, "");
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(settings.whatsappInquiryMessage)}`;
      setTopBarWhatsappUrl(url);
      setFormattedPhone(formatPhoneNumber(settings.storePhone));
    }
  }, [settings.storePhone, settings.whatsappInquiryMessage, formatPhoneNumber]);

  const categoryTree = useStoreCategories();

  return (
    <header className="sticky top-0 z-40 bg-[#111111] border-b border-[#27272a]">
      {/* 1. Utility Top Bar with dynamic Settings */}
      <div className="bg-[#18181b] text-[#f5f5f5] text-xs py-1.5 px-4 sm:px-8 flex justify-between items-center font-medium border-b border-[#27272a]">
        <a
          href={topBarWhatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <Phone className="w-3.5 h-3.5 text-[#34d399]" />
          <span>
            Atención WhatsApp: <strong>{formattedPhone || "-"}</strong>
          </span>
        </a>
        {/* <div className="hidden md:flex gap-4 text-[#a1a1aa]">
          <span>{settings.shippingInfo || 'Envíos a todo el país en 24/48hs'}</span>
          <span>•</span>
          <span>Fragancias 100% Originales</span>
        </div> */}
      </div>

      {/* 2. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile Menu Trigger + Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-full text-[#f5f5f5] hover:bg-[#18181b] transition-colors cursor-pointer"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>

          <Link
            href="/"
            className="flex items-center gap-2 group cursor-pointer py-1"
          >
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
        <nav className="hidden md:flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
          <Link href="/#catalogo" className={NAV_ITEM_CLASS}>
            Catálogo
          </Link>

          {categoryTree.slice(0, MAX_HEADER_CATEGORIES).map((category) => (
            <div key={category._id} className="relative group">
              <Link href={categoryHref(category)} className={NAV_ITEM_CLASS}>
                {category.name}
              </Link>

              {category.children.length > 0 && (
                <div className="absolute left-0 top-full z-50 hidden min-w-52 pt-2 group-hover:block group-focus-within:block">
                  <div className="rounded-2xl border border-[#27272a] bg-[#18181b] p-2 shadow-xl">
                    {category.children.map((child) => (
                      <Link
                        key={child._id}
                        href={categoryHref(child)}
                        className="block rounded-xl px-3 py-2 text-[#f5f5f5] transition-colors hover:bg-[#f5f5f5] hover:text-[#111111]"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          <Link href="/?clearance=true#catalogo" className={NAV_OFFERS_CLASS}>
            🔥 Ofertas
          </Link>
        </nav>

        {/* Right: Search Pill & Cart Icon */}
        <div className="flex items-center gap-3">
          {/* Search Pill */}
          <SearchBar
            tone="dark"
            onSearchChange={onSearchChange}
            placeholder="Buscar perfumes, fragancias..."
            className="hidden sm:block w-52 md:w-64"
          />

          {/* Cart Button */}
          <button
            onClick={openCart}
            className="relative flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-[#e5e5e5] hover:border-[#111111] text-xs font-bold text-[#111111] transition-all active:scale-95 shadow-xs cursor-pointer"
            aria-label="Ver Carrito"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#111111]" />
            Carrito
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
        <div className="md:hidden bg-[#111111] border-b border-[#27272a] px-6 py-4 space-y-4 animate-in slide-in-from-top duration-200">
          <SearchBar
            tone="dark"
            onSearchChange={onSearchChange}
            placeholder="Buscar perfumes, fragancias..."
            className="w-full"
            inputClassName="text-sm py-2.5 pl-10 pr-8"
          />

          <nav className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider">
            <Link
              href="/#catalogo"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-[#f5f5f5] hover:bg-[#18181b]"
            >
              Catálogo
            </Link>

            {categoryTree.map((category) => (
              <div key={category._id}>
                <Link
                  href={categoryHref(category)}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-[#f5f5f5] hover:bg-[#18181b]"
                >
                  {category.name}
                </Link>

                {category.children.map((child) => (
                  <Link
                    key={child._id}
                    href={categoryHref(child)}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 pl-8 pr-3 rounded-xl font-semibold normal-case tracking-normal text-[#a1a1aa] transition-colors cursor-pointer hover:bg-[#18181b] hover:text-[#f5f5f5]"
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            ))}

            <Link
              href="/?clearance=true#catalogo"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-[#d30005] hover:bg-[#d30005]/10"
            >
              🔥 Ofertas
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};
