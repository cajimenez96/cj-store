"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShoppingBag,
  Package,
  Tag,
  Layers,
  Image as ImageIcon,
  BarChart3,
  LogOut,
  Shield,
  Settings,
  Boxes,
  DollarSign,
  Users as UsersIcon,
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
    { label: "Stock", href: "/admin/stock", icon: Boxes },
    { label: "Marcas", href: "/admin/brands", icon: Tag },
    { label: "Tipos", href: "/admin/types", icon: Layers },
    { label: "Promociones", href: "/admin/promotions", icon: ImageIcon },
    { label: "Reportes", href: "/admin/reports", icon: BarChart3 },
    { label: "Contabilidad", href: "/admin/accounting", icon: DollarSign },
    { label: "Usuarios", href: "/admin/users", icon: UsersIcon },
    { label: "Ajustes", href: "/admin/settings", icon: Settings },
  ];

  return (
    <header className="bg-[#111111] text-white border-b border-[#39393b] sticky top-0 z-40">
      <div className="max-w-8xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Lockup */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-full text-white">
            <Shield className="w-5 h-5" />
          </div>
          <Link
            href="/admin/orders"
            className="font-extrabold text-xl tracking-tighter uppercase cursor-pointer"
          >
            <span className="text-[#9e9ea0] font-light">Admin</span>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {links.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? "bg-white text-[#111111] shadow-xs"
                    : "text-[#9e9ea0] hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-white/10 hover:bg-[#d30005] text-white text-xs font-bold uppercase tracking-wider rounded-full transition-all flex items-center gap-2 cursor-pointer active:scale-95"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>

      {/* Mobile Sub-Nav */}
      <div className="lg:hidden flex overflow-x-auto px-4 py-2 bg-[#39393b]/40 gap-2 no-scrollbar">
        {links.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-full whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? "bg-white text-[#111111]"
                  : "text-[#9e9ea0] hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
};
