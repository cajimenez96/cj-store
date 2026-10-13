import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type OrderStatus =
  | 'pendiente'
  | 'autorizado'
  | 'cancelado'
  // Legacy statuses — kept for backward compatibility with existing documents
  | 'confirmada'
  | 'completada'
  | 'cancelada';

export type OrderOrigin = 'web' | 'admin_direct';
export type AppliedPriceType = 'retail' | 'wholesale' | 'custom';
export type PaymentMethodType = 'transferencia' | 'efectivo' | 'tarjeta' | 'otro';

export interface IOrderItem {
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  sku?: string;
  name: string;
  image?: string;
  imageUrl?: string;
  variantLabel?: string;
  variantName?: string;
  qty: number;
  appliedPriceType: AppliedPriceType;
  unitPrice: number;
  subtotal: number;
}

export interface ICustomerGuest {
  name: string;
  lastName: string;
  phone: string;
}

export interface IOrder {
  orderNumber: string;
  origin: OrderOrigin;
  guest: ICustomerGuest;
  items: IOrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethodType;
  status: OrderStatus;
  notes?: string;
  cancelReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IOrderDocument extends IOrder, Document {}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'El producto es obligatorio'],
    },
    variantId: {
      type: Schema.Types.ObjectId,
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'El nombre del producto en el ítem es obligatorio'],
    },
    image: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    variantLabel: {
      type: String,
      trim: true,
    },
    variantName: {
      type: String,
      trim: true,
    },
    qty: {
      type: Number,
      required: [true, 'La cantidad es obligatoria'],
      min: [1, 'La cantidad mínima es 1'],
    },
    appliedPriceType: {
      type: String,
      enum: ['retail', 'wholesale', 'custom'],
      default: 'retail',
    },
    unitPrice: {
      type: Number,
      required: [true, 'El precio unitario es obligatorio'],
      min: [0, 'El precio unitario no puede ser negativo'],
    },
    subtotal: {
      type: Number,
      required: [true, 'El subtotal del ítem es obligatorio'],
      min: [0, 'El subtotal no puede ser negativo'],
    },
  },
  { _id: false }
);

const CustomerGuestSchema = new Schema<ICustomerGuest>(
  {
    name: {
      type: String,
      required: [true, 'El nombre del cliente es obligatorio'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'El apellido del cliente es obligatorio'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'El teléfono del cliente es obligatorio'],
      trim: true,
    },
  },
  { _id: false }
);

const OrderSchema: Schema<IOrderDocument> = new Schema(
  {
    orderNumber: {
      type: String,
      required: [true, 'El número de orden es obligatorio'],
      unique: true,
      index: true,
      trim: true,
    },
    origin: {
      type: String,
      enum: ['web', 'admin_direct'],
      default: 'web',
      index: true,
    },
    guest: {
      type: CustomerGuestSchema,
      required: true,
    },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: [
        (val: IOrderItem[]) => val.length > 0,
        'La orden debe contener al menos un ítem',
      ],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['transferencia', 'efectivo', 'tarjeta', 'otro'],
      default: 'transferencia',
    },
    status: {
      type: String,
      enum: ['pendiente', 'autorizado', 'cancelado', 'confirmada', 'completada', 'cancelada'],
      default: 'pendiente',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    cancelReason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ origin: 1, createdAt: -1 });

const Order: Model<IOrderDocument> =
  mongoose.models.Order || mongoose.model<IOrderDocument>('Order', OrderSchema);

export default Order;
