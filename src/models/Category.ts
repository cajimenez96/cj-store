import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ISpecAttributeDefinition {
  key: string;
  required: boolean;
}

export interface ICategory {
  name: string;
  slug: string; // Slug único para URL y jerarquía
  parentId?: Types.ObjectId | null;
  ancestors: Types.ObjectId[]; // Cadena de ancestros [raíz, ..., padre] para búsquedas rápidas
  variantAxes: string[]; // Keys de atributos tipo 'select' que forman variantes (ej: ["talle", "color"])
  imageAxis?: string; // Eje de variación que define grupos de imágenes (ej: "color")
  specAttributes: ISpecAttributeDefinition[]; // Especificaciones de ficha técnica
  order: number;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICategoryDocument extends ICategory, Document {}

const SpecAttributeDefinitionSchema = new Schema<ISpecAttributeDefinition>(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

const CategorySchema = new Schema<ICategoryDocument>(
  {
    name: {
      type: String,
      required: [true, 'El nombre de la categoría es obligatorio'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'El slug de la categoría es obligatorio'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    ancestors: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
      default: [],
    },
    variantAxes: {
      type: [String],
      default: [],
    },
    imageAxis: {
      type: String,
      trim: true,
      lowercase: true,
    },
    specAttributes: {
      type: [SpecAttributeDefinitionSchema],
      default: [],
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para optimizar listados, orden y búsquedas en árbol
CategorySchema.index({ parentId: 1, order: 1 });
CategorySchema.index({ ancestors: 1 });
CategorySchema.index({ active: 1, order: 1 });

const Category: Model<ICategoryDocument> =
  mongoose.models.Category || mongoose.model<ICategoryDocument>('Category', CategorySchema);

export default Category;
