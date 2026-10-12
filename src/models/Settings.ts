import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISettings {
  // Identity & Contact
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

  // Bank Data
  bankAlias: string;
  bankCbu: string;
  bankHolder: string;
  bankCuit: string;
  bankName: string;

  // Inventory & Alerts
  minStockAlert: number;

  // Commercial Rules
  wholesaleMinPairs: number;
  shippingInfo: string;

  updatedAt?: Date;
}

export interface ISettingsDocument extends ISettings, Document {}

const SettingsSchema: Schema<ISettingsDocument> = new Schema(
  {
    // Identity & Contact
    storeName: {
      type: String,
      default: "The Point",
      trim: true,
    },
    storePhone: {
      type: String,
      default: "-",
      trim: true,
    },
    storeEmail: {
      type: String,
      default: "contacto@thepoint.com",
      trim: true,
    },
    businessHours: {
      type: String,
      default: "Lun a Sáb: 9:00 a 20:00 hs",
      trim: true,
    },
    whatsappInquiryMessage: {
      type: String,
      default: "Hola! Tengo una consulta sobre una fragancia",
      trim: true,
    },
    instagramUrl: {
      type: String,
      default: "",
      trim: true,
    },
    facebookUrl: {
      type: String,
      default: "",
      trim: true,
    },

    // SEO & Social Meta
    metaTitle: {
      type: String,
      default: "The Point | Perfumes Importados & Fragancias Exclusivas",
      trim: true,
    },
    metaDescription: {
      type: String,
      default: "Catálogo exclusivo de perfumes importados y fragancias de autor en The Point. Comprá online con atención personalizada por WhatsApp y envíos a todo el país.",
      trim: true,
    },
    metaKeywords: {
      type: String,
      default: "perfumes, fragancias, perfumes importados, the point, decants, hombre, mujer, unisex",
      trim: true,
    },
    footerDescription: {
      type: String,
      default: "Perfumería de lujo y fragancias de autor. Seleccioná tus aromas favoritos y completá tu pedido de forma fácil y directa vía WhatsApp.",
      trim: true,
    },

    // Bank Data
    bankAlias: {
      type: String,
      default: "THE.POINT",
      trim: true,
    },
    bankCbu: {
      type: String,
      default: "",
      trim: true,
    },
    bankHolder: {
      type: String,
      default: "The Point",
      trim: true,
    },
    bankCuit: {
      type: String,
      default: "",
      trim: true,
    },
    bankName: {
      type: String,
      default: "Banco Galicia",
      trim: true,
    },

    // Inventory & Alerts
    minStockAlert: {
      type: Number,
      default: 3,
      min: 0,
    },

    // Commercial Rules
    wholesaleMinPairs: {
      type: Number,
      default: 5,
      min: 1,
    },
    shippingInfo: {
      type: String,
      default: "Envíos a todo el país en 24/48hs",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

const Settings: Model<ISettingsDocument> =
  mongoose.models.Settings ||
  mongoose.model<ISettingsDocument>("Settings", SettingsSchema);

export default Settings;
