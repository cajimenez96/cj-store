import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'superadmin' | 'admin' | 'seller';

export interface IUser {
  username: string;
  passwordHash: string;
  name: string;
  email?: string;
  role: UserRole;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserDocument extends IUser, Document {}

const UserSchema: Schema<IUserDocument> = new Schema(
  {
    username: {
      type: String,
      required: [true, 'El nombre de usuario es obligatorio'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'El hash de contraseña es obligatorio'],
    },
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'seller'],
      default: 'admin',
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

const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);

export default User;
