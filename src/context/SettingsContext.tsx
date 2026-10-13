"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export interface StoreSettings {
  storeName: string;
  storePhone: string;
  storeEmail: string;
  businessHours: string;
  whatsappInquiryMessage: string;
  instagramUrl: string;
  facebookUrl: string;

  // SEO & Social Meta
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  footerDescription: string;

  bankAlias: string;
  bankCbu: string;
  bankHolder: string;
  bankCuit: string;
  bankName: string;

  minStockAlert: number;
  wholesaleMinPairs: number;
  shippingInfo: string;
  enableGenders: boolean;
}

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "The Point",
  storePhone: "-",
  storeEmail: "contacto@thepoint.com",
  businessHours: "Lun a Sáb: 9:00 a 20:00 hs",
  whatsappInquiryMessage: "Hola! Tengo una consulta sobre una fragancia",
  instagramUrl: "",
  facebookUrl: "",

  metaTitle: "The Point | Perfumes Importados & Fragancias Exclusivas",
  metaDescription:
    "Catálogo exclusivo de perfumes importados y fragancias de autor en The Point. Comprá online con atención personalizada por WhatsApp y envíos a todo el país.",
  metaKeywords:
    "perfumes, fragancias, perfumes importados, the point, decants, hombre, mujer, unisex",
  footerDescription:
    "Perfumería de lujo y fragancias de autor. Seleccioná tus aromas favoritos y completá tu pedido de forma fácil y directa vía WhatsApp.",

  bankAlias: "THE.POINT",
  bankCbu: "",
  bankHolder: "The Point",
  bankCuit: "",
  bankName: "Banco Galicia",

  minStockAlert: 3,
  wholesaleMinPairs: 5,
  shippingInfo: "Envíos a todo el país en 24/48hs",
  enableGenders: true,
};

interface SettingsContextType {
  settings: StoreSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  formatPhoneNumber: (phone: string) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (json.ok && json.data) {
        setSettings((prev) => ({
          ...prev,
          ...json.data,
        }));
      }
    } catch (err) {
      console.error("Error al cargar configuración global de tienda:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  /**
   * Formats a phone string like "5493815218630" into "+54 9 381 521-8630"
   */
  const formatPhoneNumber = (phone: string): string => {
    const clean = phone.replace(/[^0-9]/g, "");
    if (!clean) return phone;

    if (clean.startsWith("549") && clean.length >= 12) {
      const area = clean.slice(3, 6);
      const part1 = clean.slice(6, 9);
      const part2 = clean.slice(9);
      return `+54 9 ${area} ${part1}-${part2}`;
    }

    if (clean.startsWith("54") && clean.length >= 11) {
      const area = clean.slice(2, 5);
      const part1 = clean.slice(5, 8);
      const part2 = clean.slice(8);
      return `+54 ${area} ${part1}-${part2}`;
    }

    return `+${clean}`;
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        refreshSettings: fetchSettings,
        formatPhoneNumber,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error(
      "useSettings debe ser utilizado dentro de un SettingsProvider",
    );
  }
  return context;
};
