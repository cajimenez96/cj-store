import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type RecordedPaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';

export interface ISalesRecordSoldBy {
  userId: Types.ObjectId;
  username: string;
  name: string;
}

export interface ISalesRecord {
  soldBy?: ISalesRecordSoldBy;
  orderId: Types.ObjectId;
  orderNumber: string;
  confirmationDate: Date;
  recordedPaymentMethod: RecordedPaymentMethod;
  appliedDiscountNote?: string;
  finalTotal: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISalesRecordDocument extends ISalesRecord, Document {}

const SalesRecordSchema: Schema<ISalesRecordDocument> = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'El ID de la orden es obligatorio'],
      unique: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: [true, 'El número de orden es obligatorio'],
      index: true,
    },
    confirmationDate: {
      type: Date,
      default: Date.now,
    },
    recordedPaymentMethod: {
      type: String,
      enum: ['efectivo', 'transferencia', 'tarjeta', 'otro'],
      required: [true, 'El medio de pago registrado es obligatorio'],
    },
    appliedDiscountNote: {
      type: String,
      trim: true,
      default: '',
    },
    soldBy: {
      type: new Schema(
        {
          userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          username: { type: String, required: true, trim: true },
          name: { type: String, required: true, trim: true },
        },
        { _id: false }
      ),
      required: false,
    },
    finalTotal: {
      type: Number,
      required: [true, 'El total final es obligatorio'],
      min: [0, 'El total final no puede ser negativo'],
    },
  },
  {
    timestamps: true,
  }
);

const SalesRecord: Model<ISalesRecordDocument> =
  mongoose.models.SalesRecord ||
  mongoose.model<ISalesRecordDocument>('SalesRecord', SalesRecordSchema);

export default SalesRecord;
