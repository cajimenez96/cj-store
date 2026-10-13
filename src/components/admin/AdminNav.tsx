"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ShoppingBag,
  Package,
  Tag,
  Layers,
  Image as ImageIcon,
  BarChart3,
  LogOut,
  Settings,
  Boxes,
  Sliders,
  DollarSign,
  Users as UsersIcon,
  ExternalLink,
} from "lucide-react";

export const AdminNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  };

  const links = [
    { label: "Solicitudes", href: "/admin/orders", icon: ShoppingBag },
    { label: "Productos", href: "/admin/products", icon: Package },
    { label: "Categorías", href: "/admin/categories", icon: Layers },
    { label: "Atributos", href: "/admin/attributes", icon: Sliders },
    { label: "Stock", href: "/admin/stock", icon: Boxes },
    { label: "Marcas", href: "/admin/brands", icon: Tag },
    { label: "Promociones", href: "/admin/promotions", icon: ImageIcon },
    { label: "Reportes", href: "/admin/reports", icon: BarChart3 },
    { label: "Contabilidad", href: "/admin/accounting", icon: DollarSign },
    { label: "Usuarios", href: "/admin/users", icon: UsersIcon },
    { label: "Ajustes", href: "/admin/settings", icon: Settings },
  ];

  return (
    <header className="bg-[#111111] text-white border-b border-[#2d2d30] sticky top-0 z-40 shadow-sm">
      {/* 1. Top Bar: Brand & Utilities */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
        {/* Brand Lockup */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="flex items-center gap-2.5 group cursor-pointer py-1"
          >
            <Image
              src="/logo-nav.png"
              alt="The Point Admin"
              width={140}
              height={24}
              priority
              className="h-6 w-auto object-contain brightness-105 group-hover:opacity-85 transition-opacity"
            />
            <span className="text-[10px] tracking-widest uppercase bg-white/10 text-neutral-300 font-semibold px-2 py-0.5 rounded-full">
              Admin
            </span>
          </Link>
        </div>

        {/* Right utility actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            target="_blank"
            className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/5"
            title="Abrir tienda en nueva pestaña"
          >
            <span className="hidden sm:inline">Ver tienda</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-[#d30005] text-white text-xs font-semibold uppercase tracking-wider rounded-full transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* 2. Navigation Tabs Bar (Contained horizontal scroll, no window scroll) */}
      <div className="border-t border-white/10 bg-[#161619]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <nav className="flex items-center gap-1.5 overflow-x-auto py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {links.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
                    isActive
                      ? "bg-white text-[#111111] shadow-xs"
                      : "text-[#9e9ea0] hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
