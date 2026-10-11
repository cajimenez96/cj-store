import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type GenderType = 'Hombre' | 'Mujer' | 'Niño' | 'Unisex';

export interface IProductImage {
  url: string;
  fileId?: string;
  isPrincipal: boolean;
  position: number;
}

export interface ISizeStock {
  size: number;
  stock: number;
}

export interface IVariantStock {
  name: string;
  stock: number;
  sku?: string;
}

export interface IProduct {
  name: string;
  description: string;
  /** @deprecated Use retailPrice instead */
  price?: number;
  retailPrice: number;
  wholesalePrice: number;
  brandId: Types.ObjectId;
  typeId: Types.ObjectId;
  gender?: GenderType | null;
  active: boolean;
  isClearance?: boolean;
  images: IProductImage[];
  stock?: number;
  variants?: IVariantStock[];
  /** @deprecated Legacy shoe sizes - maintained for backward compatibility */
  sizesStock?: ISizeStock[];
  /** @deprecated Legacy shoe displayed sizes */
  displayedSizes?: number[];
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
  },
  { _id: false }
);

const VariantStockSchema = new Schema<IVariantStock>(
  {
    name: { type: String, required: true, trim: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    sku: { type: String, trim: true },
  },
  { _id: false }
);

const SizeStockSchema = new Schema<ISizeStock>(
  {
    size: { type: Number, required: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
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
    description: {
      type: String,
      required: [true, 'La descripción del producto es obligatoria'],
      trim: true,
    },
    // Legacy field — kept for backward compatibility with existing documents
    price: {
      type: Number,
      min: [0, 'El precio no puede ser negativo'],
    },
    retailPrice: {
      type: Number,
      required: [true, 'El precio minorista es obligatorio'],
      min: [0, 'El precio minorista no puede ser negativo'],
    },
    wholesalePrice: {
      type: Number,
      required: [true, 'El precio mayorista es obligatorio'],
      min: [0, 'El precio mayorista no puede ser negativo'],
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: [true, 'La marca es obligatoria'],
    },
    typeId: {
      type: Schema.Types.ObjectId,
      ref: 'FootwearType',
      required: [true, 'La categoría/tipo es obligatoria'],
    },
    gender: {
      type: String,
      enum: {
        values: ['Hombre', 'Mujer', 'Niño', 'Unisex', null],
        message: '{VALUE} no es un género válido',
      },
      default: null,
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
    images: {
      type: [ProductImageSchema],
      default: [],
    },
    stock: {
      type: Number,
      min: [0, 'El stock no puede ser negativo'],
      default: 0,
    },
    variants: {
      type: [VariantStockSchema],
      default: [],
    },
    sizesStock: {
      type: [SizeStockSchema],
      default: [],
    },
    displayedSizes: {
      type: [Number],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes for fast catalog queries and filtering
ProductSchema.index({ active: 1, brandId: 1, typeId: 1, gender: 1 });
ProductSchema.index({ active: 1, isClearance: 1 });
ProductSchema.index({ 'variants.name': 1 });
ProductSchema.index({ 'sizesStock.size': 1 });

const Product: Model<IProductDocument> =
  mongoose.models.Product || mongoose.model<IProductDocument>('Product', ProductSchema);

export default Product;
