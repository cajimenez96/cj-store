import mongoose, { Schema, Document, Model } from 'mongoose';

export type AttributeType = 'select' | 'text' | 'number' | 'boolean';

export interface IAttributeOption {
  value: string; // Slug estable: "negro", "100ml", "m". Inmutable
  label: string; // "Negro", "100 ml", "M". Editable
  order: number; // Orden lógico (S < M < L), no alfabético
  hex?: string; // Solo colores: código hexadecimal
  active: boolean; // Se desactiva en vez de borrarse si está en uso
}

export interface IAttribute {
  key: string; // "color", "talle_calzado", "volumen". Inmutable, único
  label: string; // "Color", "Talle", "Contenido"
  type: AttributeType;
  options: IAttributeOption[]; // Opciones para atributos de tipo 'select'
  unit?: string; // "ml", "g", "cm" para tipo 'number'
  filterable: boolean; // Flag para habilitar filtros en la tienda
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAttributeDocument extends IAttribute, Document {}

const AttributeOptionSchema = new Schema<IAttributeOption>(
  {
    value: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    hex: {
      type: String,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const AttributeSchema = new Schema<IAttributeDocument>(
  {
    key: {
      type: String,
      required: [true, 'El identificador (key) del atributo es obligatorio'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: [true, 'La etiqueta (label) del atributo es obligatoria'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['select', 'text', 'number', 'boolean'],
      default: 'select',
      required: true,
    },
    options: {
      type: [AttributeOptionSchema],
      default: [],
    },
    unit: {
      type: String,
      trim: true,
    },
    filterable: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Attribute: Model<IAttributeDocument> =
  mongoose.models.Attribute || mongoose.model<IAttributeDocument>('Attribute', AttributeSchema);

export default Attribute;
