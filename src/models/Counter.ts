import mongoose, { Schema, Document, Model, ClientSession } from 'mongoose';

export interface ICounter {
  name: string;
  seq: number;
  updatedAt?: Date;
}

export interface ICounterDocument extends ICounter, Document {}

const CounterSchema = new Schema<ICounterDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    seq: {
      type: Number,
      default: 1000, // Starts at 1000 for friendly order numbers (1001, 1002...)
    },
  },
  {
    timestamps: true,
  }
);

export async function getNextSequence(
  name: string,
  session?: ClientSession
): Promise<number> {
  const options: mongoose.QueryOptions = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  };

  if (session) {
    options.session = session;
  }

  const result = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    options
  );

  return result ? result.seq : 1000;
}

const Counter: Model<ICounterDocument> =
  mongoose.models.Counter || mongoose.model<ICounterDocument>('Counter', CounterSchema);

export default Counter;
