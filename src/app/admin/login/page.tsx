"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Lock, User, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/admin/orders";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Por favor ingresá usuario y contraseña");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.message || "Credenciales de acceso incorrectas");
      }

      toast.success("¡Sesión iniciada correctamente!", {
        description: "Redirigiendo al panel...",
      });
      window.location.href = redirectPath;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al iniciar sesión",
      );
    } finally {
      setLoading(false);
    }
  };

  // const handleForgotPassword = () => {
  //   toast.info("Recuperación de contraseña", {
  //     description:
  //       "Por razones de seguridad, comunicate con el administrador general del sistema.",
  //   });
  // };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-[#070709] overflow-hidden select-none">
      {/* Luxury Dark Satin / Silk Textured Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Radial ambient lighting with warm golden highlights */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#181512_0%,#0c0b0e_55%,#050507_100%)]" />

        {/* Fluid silk folds & wave curves */}
        <svg
          className="absolute -top-[10%] -left-[10%] w-[120%] h-[120%] opacity-35 blur-[2px] pointer-events-none"
          viewBox="0 0 1200 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M-100,200 C300,50 450,550 750,300 C1050,50 1200,450 1350,300 L1350,900 L-100,900 Z"
            fill="url(#satin-wave-1)"
          />
          <path
            d="M-50,600 C250,350 500,750 850,500 C1100,320 1250,600 1350,550 L1350,900 L-50,900 Z"
            fill="url(#satin-wave-2)"
          />
          <defs>
            <linearGradient
              id="satin-wave-1"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#2c2419" stopOpacity="0.45" />
              <stop offset="35%" stopColor="#141316" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#3d3324" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#070709" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient
              id="satin-wave-2"
              x1="100%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#1e1b17" stopOpacity="0.7" />
              <stop offset="45%" stopColor="#453826" stopOpacity="0.25" />
              <stop offset="85%" stopColor="#0f0e11" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#050507" stopOpacity="1" />
            </linearGradient>
          </defs>
        </svg>

        {/* Ambient golden aura on corners */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_top_right,rgba(197,168,128,0.12),transparent_70%)]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_bottom_left,rgba(197,168,128,0.08),transparent_70%)]" />
      </div>

      {/* Login Card matching mockup */}
      <div className="relative z-10 w-full max-w-[390px] bg-[#0c0c0e]/85 backdrop-blur-xl border border-white/[0.07] rounded-3xl px-8 py-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col items-center">
        {/* Brand Logo (Shield emblem + THE POINT) */}
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/logotipo.png"
            alt="The Point"
            width={180}
            height={142}
            priority
            className="h-28 w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
          />
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Usuario*/}
          <div className="relative">
            <User className="w-5 h-5 text-[#C5A880] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#141417]/90 border border-[#2b2b31] text-white placeholder-[#717178] text-sm rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:border-[#C5A880] focus:ring-1 focus:ring-[#C5A880]/50 transition-all [color-scheme:dark] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#141417_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#fff]"
              required
            />
          </div>

          {/* Contraseña */}
          <div className="relative">
            <Lock className="w-5 h-5 text-[#C5A880] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#141417]/90 border border-[#2b2b31] text-white placeholder-[#717178] text-sm rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:border-[#C5A880] focus:ring-1 focus:ring-[#C5A880]/50 transition-all [color-scheme:dark] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#141417_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#fff]"
              required
            />
          </div>

          {/* Botón Ingresar */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-[#C5A880] hover:bg-[#b8996e] active:scale-[0.99] text-[#121212] font-semibold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#C5A880]/15 disabled:opacity-50 cursor-pointer mt-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#121212]" />
                <span>Ingresando...</span>
              </>
            ) : (
              "Ingresar"
            )}
          </button>
        </form>

        {/* ¿Olvidaste tu contraseña? */}
        {/* <div className="mt-5 text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-xs text-[#a38f72] hover:text-[#d8bb94] transition-colors cursor-pointer font-normal"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div> */}
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070709] flex items-center justify-center text-[#C5A880] text-xs">
          Cargando panel de administración...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
