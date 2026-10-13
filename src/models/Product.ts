import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IProductImage {
  _id?: Types.ObjectId;
  url: string;
  fileId?: string;
  isPrincipal: boolean;
  position: number;
  axisValue?: string; // Valor del imageAxis (ej: "negro"). Vacío = foto general
}

export interface IVariantOption {
  key: string;
  value: string;
}

export interface IVariant {
  _id?: Types.ObjectId;
  sku: string;
  name?: string;
  options: IVariantOption[];
  retailPrice: number;
  wholesalePrice?: number;
  stock: number;
  active: boolean;
}

export interface ISpecItem {
  key: string;
  value: string | number | boolean;
}

export interface IWholesaleSettings {
  enabled: boolean;
  minQty?: number;
}

export interface IProduct {
  name: string;
  slug?: string;
  description: string;
  categoryId?: Types.ObjectId;
  categoryAncestors?: Types.ObjectId[];
  brandId?: Types.ObjectId;
  active: boolean;
  isClearance?: boolean;
  specs?: ISpecItem[];
  wholesale?: IWholesaleSettings;
  images: IProductImage[];
  variants?: IVariant[];

  // Derived fields recalculated on save
  priceRange?: {
    min: number;
    max: number;
  };
  totalStock?: number;
  hasWholesale?: boolean;

  // Legacy fields
  price?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  stock?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IProductDocument extends IProduct, Document {}

const ProductImageSchema = new Schema<IProductImage>(
  {
    url: { type: String, required: true },
    fileId: { type: String },
    isPrincipal: { type: Boolean, default: false },
    position: { type: Number, default: 0 },
    axisValue: { type: String, trim: true, lowercase: true },
  },
  { _id: true }
);

const VariantOptionSchema = new Schema<IVariantOption>(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    value: { type: String, required: true, trim: true, lowercase: true },
  },
  { _id: false }
);

const VariantSchema = new Schema<IVariant>(
  {
    sku: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, trim: true },
    options: { type: [VariantOptionSchema], default: [] },
    retailPrice: { type: Number, required: true, min: 0 },
    wholesalePrice: { type: Number, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    active: { type: Boolean, default: true },
  },
  { _id: true }
);

const SpecItemSchema = new Schema<ISpecItem>(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const ProductSchema: Schema<IProductDocument> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre del producto es obligatorio'],
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
    },
    categoryAncestors: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
      default: [],
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
    },
    active: {
      type: Boolean,
      default: true,
    },
    isClearance: {
      type: Boolean,
      default: false,
      index: true,
    },
    specs: {
      type: [SpecItemSchema],
      default: [],
    },
    wholesale: {
      enabled: { type: Boolean, default: false },
      minQty: { type: Number, min: 1, default: 5 },
    },
    images: {
      type: [ProductImageSchema],
      default: [],
    },
    variants: {
      type: [VariantSchema],
      default: [],
    },
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
    },
    totalStock: {
      type: Number,
      default: 0,
    },
    hasWholesale: {
      type: Boolean,
      default: false,
    },

    // Legacy fields for backward compatibility
    price: { type: Number, min: 0 },
    retailPrice: { type: Number, min: 0 },
    wholesalePrice: { type: Number, min: 0 },
    stock: { type: Number, min: 0, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Indexes
ProductSchema.index({ active: 1, categoryAncestors: 1, 'priceRange.min': 1 });
ProductSchema.index({ active: 1, brandId: 1 });
ProductSchema.index({ 'variants.sku': 1 });
ProductSchema.index({ slug: 1 }, { unique: true, sparse: true });
ProductSchema.index({ 'variants.options.key': 1, 'variants.options.value': 1 });
ProductSchema.index({ name: 'text', description: 'text' });

const Product: Model<IProductDocument> =
  mongoose.models.Product || mongoose.model<IProductDocument>('Product', ProductSchema);

export default Product;
