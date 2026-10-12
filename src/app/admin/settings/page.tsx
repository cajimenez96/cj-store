"use client";

import React, { useState, useEffect } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  Store,
  Phone,
  Mail,
  Clock,
  Globe,
  CreditCard,
  Package,
  Truck,
  Save,
  Loader2,
  ShieldCheck,
  Building2,
  Boxes,
  ShoppingBag,
  Tag,
  Sliders,
  DollarSign,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { GenderSizesManager } from "@/components/admin/GenderSizesManager";

export default function AdminSettingsPage() {
  // Identity & Contact
  const [storeName, setStoreName] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [whatsappInquiryMessage, setWhatsappInquiryMessage] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");

  // SEO & Social Meta
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaKeywords, setMetaKeywords] = useState("");
  const [footerDescription, setFooterDescription] = useState("");

  // Bank Data
  const [bankAlias, setBankAlias] = useState("");
  const [bankCbu, setBankCbu] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankCuit, setBankCuit] = useState("");
  const [bankName, setBankName] = useState("");

  // Inventory & Business Rules
  const [minStockAlert, setMinStockAlert] = useState<number | "">(3);
  const [wholesaleMinPairs, setWholesaleMinPairs] = useState<number | "">(5);
  const [shippingInfo, setShippingInfo] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/admin/settings");
        const json = await res.json();
        if (json.ok && json.data) {
          const s = json.data;
          setStoreName(s.storeName || "");
          setStorePhone(s.storePhone || "");
          setStoreEmail(s.storeEmail || "");
          setBusinessHours(s.businessHours || "");
          setWhatsappInquiryMessage(s.whatsappInquiryMessage || "");
          setInstagramUrl(s.instagramUrl || "");
          setFacebookUrl(s.facebookUrl || "");

          setMetaTitle(s.metaTitle || "");
          setMetaDescription(s.metaDescription || "");
          setMetaKeywords(s.metaKeywords || "");
          setFooterDescription(s.footerDescription || "");

          setBankAlias(s.bankAlias || "");
          setBankCbu(s.bankCbu || "");
          setBankHolder(s.bankHolder || "");
          setBankCuit(s.bankCuit || "");
          setBankName(s.bankName || "");

          setMinStockAlert(s.minStockAlert ?? 3);
          setWholesaleMinPairs(s.wholesaleMinPairs ?? 5);
          setShippingInfo(s.shippingInfo || "");
        }
      } catch (err) {
        console.error("Error al cargar configuraciones:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          storePhone,
          storeEmail,
          businessHours,
          whatsappInquiryMessage,
          instagramUrl,
          facebookUrl,
          metaTitle,
          metaDescription,
          metaKeywords,
          footerDescription,
          bankAlias,
          bankCbu,
          bankHolder,
          bankCuit,
          bankName,
          minStockAlert: minStockAlert === "" ? 3 : Number(minStockAlert),
          wholesaleMinPairs:
            wholesaleMinPairs === "" ? 5 : Number(wholesaleMinPairs),
          shippingInfo,
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.message || "Error al actualizar los ajustes");
      }

      toast.success("¡Ajustes del sistema y de la tienda actualizados correctamente!", {
        description: "Los cambios ya son visibles en la tienda.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar los cambios", {
        description: "Revisá los datos e intentá nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#111111] font-sans">
      <AdminNav />

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-[#111111] flex items-center gap-2">
            <Store className="w-7 h-7" /> Configuración de la Tienda
          </h1>
          <p className="text-xs text-[#707072] mt-1">
            Administrá los datos públicos del negocio, contacto de WhatsApp,
            cuentas bancarias y reglas de inventario.
          </p>
        </div>

        {loading ? (
          <div className="bg-white border border-[#e5e5e5] p-6 space-y-6 animate-pulse">
            <div className="h-4 bg-[#e5e5e5] w-1/3 rounded"></div>
            <div className="space-y-4">
              <div className="h-10 bg-[#e5e5e5] rounded w-full"></div>
              <div className="h-10 bg-[#e5e5e5] rounded w-full"></div>
              <div className="h-10 bg-[#e5e5e5] rounded w-full"></div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* SECCIÓN 1: Identidad & Contacto */}
            <div className="bg-white border border-[#e5e5e5] p-6 sm:p-8 space-y-5 shadow-sm">
              <div className="border-b border-[#e5e5e5] pb-3 flex items-center gap-2">
                <Phone className="w-5 h-5 text-[#007d48]" />
                <div>
                  <h2 className="text-base font-extrabold uppercase tracking-wider text-[#111111]">
                    Identidad, Contacto & WhatsApp
                  </h2>
                  <p className="text-xs text-[#707072]">
                    Datos visibles en el footer, botones de compra y mensajes.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5" /> Nombre de la Tienda *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: The Point"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-bold py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#007d48]" /> Teléfono
                    WhatsApp (con código de país) *
                  </label>
                  <input
                    type="text"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-bold py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                  <p className="text-[10px] text-[#707072] mt-1">
                    Sin espacios ni signos (+, -). Ej: 5491123456789
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Horarios de Atención
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Lun a Sáb: 9:00 a 20:00 hs"
                    value={businessHours}
                    onChange={(e) => setBusinessHours(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email de Contacto
                  </label>
                  <input
                    type="email"
                    placeholder="Ej: contacto@thepoint.com"
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                    Mensaje por defecto para consultas rápidas
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Hola! Tengo una consulta sobre una fragancia"
                    value={whatsappInquiryMessage}
                    onChange={(e) => setWhatsappInquiryMessage(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                  <p className="text-[10px] text-[#707072] mt-1">
                    Texto pre-cargado cuando el usuario hace clic en contactar
                    desde el footer.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-pink-600" /> Perfil de
                    Instagram (URL)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: https://instagram.com/thepoint"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600" /> Facebook
                    (URL)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: https://facebook.com/thepoint"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: Datos Bancarios */}
            <div className="bg-white border border-[#e5e5e5] p-6 sm:p-8 space-y-5 shadow-sm">
              <div className="border-b border-[#e5e5e5] pb-3 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#111111]" />
                <div>
                  <h2 className="text-base font-extrabold uppercase tracking-wider text-[#111111]">
                    Datos de Cobro & Transferencia
                  </h2>
                  <p className="text-xs text-[#707072]">
                    Información bancaria proporcionada al cliente en el paso
                    final del checkout.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                    Alias Bancario *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: THE.POINT"
                    value={bankAlias}
                    onChange={(e) => setBankAlias(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-extrabold py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                    CBU / CVU (22 dígitos)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 0000003100010000000000"
                    value={bankCbu}
                    onChange={(e) => setBankCbu(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-bold py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                    Titular de la Cuenta *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: The Point"
                    value={bankHolder}
                    onChange={(e) => setBankHolder(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-bold py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                    CUIT / CUIL del Titular
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 20-12345678-9"
                    value={bankCuit}
                    onChange={(e) => setBankCuit(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Banco o Billetera
                    Virtual
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Banco Galicia / Mercado Pago"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-bold py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: Inventario & Stock Crítico */}
            <div className="bg-white border border-[#e5e5e5] p-6 sm:p-8 space-y-5 shadow-sm">
              <div className="border-b border-[#e5e5e5] pb-3 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-[#f59e0b]" />
                <div>
                  <h2 className="text-base font-extrabold uppercase tracking-wider text-[#111111]">
                    Reglas de Inventario & Alertas de Stock
                  </h2>
                  <p className="text-xs text-[#707072]">
                    Parámetros de aviso para reposición de mercadería.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                  Stock Mínimo de Alerta (Cantidad Total de Pares por Producto)
                  *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    placeholder="3"
                    value={minStockAlert}
                    onChange={(e) =>
                      setMinStockAlert(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="w-32 bg-[#f5f5f5] text-[#111111] text-base font-extrabold py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                  <span className="text-xs font-semibold text-[#707072]">
                    pares en total sumando todos los talles.
                  </span>
                </div>
                <p className="text-[11px] text-[#707072] mt-2">
                  Cuando la <strong>suma total de pares</strong> de un modelo
                  sea menor o igual a este valor, aparecerá resaltado en naranja
                  en la sección de Control de Stock.
                </p>
              </div>
            </div>

            {/* SECCIÓN 4: Reglas Comerciales */}
            <div className="bg-white border border-[#e5e5e5] p-6 sm:p-8 space-y-5 shadow-sm">
              <div className="border-b border-[#e5e5e5] pb-3 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#007d48]" />
                <div>
                  <h2 className="text-base font-extrabold uppercase tracking-wider text-[#111111]">
                    Reglas Comerciales & Mayoristas
                  </h2>
                  <p className="text-xs text-[#707072]">
                    Condiciones de compra y promociones activas.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#007d48]" /> Pares Mínimos
                    para Precio Mayorista *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="5"
                      value={wholesaleMinPairs}
                      onChange={(e) =>
                        setWholesaleMinPairs(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      className="w-28 bg-[#f5f5f5] text-[#111111] text-base font-extrabold py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                    />
                    <span className="text-xs text-[#707072] font-semibold">
                      pares
                    </span>
                  </div>
                  <p className="text-[10px] text-[#707072] mt-1">
                    Cantidad combinada en el carrito que activa los precios
                    mayoristas.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" /> Texto Informativo de
                    Envíos
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Despacho en 24hs a todo el país"
                    value={shippingInfo}
                    onChange={(e) => setShippingInfo(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                  <p className="text-[10px] text-[#707072] mt-1">
                    Texto descriptivo en el footer y resúmenes de envío.
                  </p>
                </div>
              </div>
            </div>

            {/* SECCIÓN 5: SEO & Posicionamiento */}
            <div className="bg-white border border-[#e5e5e5] p-6 sm:p-8 space-y-5 shadow-sm">
              <div className="border-b border-[#e5e5e5] pb-3 flex items-center gap-2">
                <Search className="w-5 h-5 text-[#111111]" />
                <div>
                  <h2 className="text-base font-extrabold uppercase tracking-wider text-[#111111] flex items-center gap-2">
                    <span>SEO, Buscadores & Redes Sociales</span>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </h2>
                  <p className="text-xs text-[#707072]">
                    Configurá cómo aparece The Point en Google, WhatsApp, Facebook y buscadores.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                    Título Global de la Página (Meta Title) *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: The Point | Perfumes Importados & Fragancias Exclusivas"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-bold py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                  <p className="text-[10px] text-[#707072] mt-1">
                    Es el título que se muestra en la pestaña del navegador y en los resultados de Google.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                    Descripción del Sitio (Meta Description) *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ej: Catálogo exclusivo de perfumes importados y fragancias de autor en The Point. Comprá online con atención personalizada por WhatsApp y envíos a todo el país."
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                  <p className="text-[10px] text-[#707072] mt-1">
                    Resumen visible bajo el título en Google y al compartir el link en WhatsApp o redes sociales.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                    Palabras Clave (Keywords separadas por comas)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: perfumes, fragancias, perfumes importados, the point, dior, chanel"
                    value={metaKeywords}
                    onChange={(e) => setMetaKeywords(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                    Texto Descriptivo del Pie de Página (Footer)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ej: Perfumería de lujo y fragancias de autor. Seleccioná tus aromas favoritos y completá tu pedido de forma fácil y directa vía WhatsApp."
                    value={footerDescription}
                    onChange={(e) => setFooterDescription(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 6: Escala de Talles por Género (ABM) */}
            <GenderSizesManager />

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-[#111111] hover:bg-black text-white font-bold text-sm uppercase tracking-wider rounded-full flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Guardando
                    Ajustes...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" /> Guardar Todos los Ajustes
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
