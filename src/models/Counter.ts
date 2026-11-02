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
  const opts = session ? { session } : {};
  const increment = () =>
    Counter.findOneAndUpdate({ name }, { $inc: { seq: 1 } }, { ...opts, returnDocument: 'after' });

  // A single upsert with `$inc` cannot use the schema default: Mongoose drops
  // the `seq` default from `$setOnInsert` because `$inc` already targets the
  // path, so the first value would be 1 instead of 1001. Seed the counter
  // with `$setOnInsert` first (idempotent; concurrent seeds are resolved by
  // the unique `name` index), then increment atomically.
  let result = await increment();
  if (!result) {
    try {
      await Counter.updateOne({ name }, { $setOnInsert: { seq: 1000 } }, { ...opts, upsert: true });
    } catch (err) {
      // Another caller seeded it first; inside a transaction let it surface
      // so the transaction is retried as a whole.
      if (session || (err as { code?: number }).code !== 11000) throw err;
    }
    result = await increment();
  }
  if (!result) {
    throw new Error(`No se pudo obtener la secuencia "${name}"`);
  }
  return result.seq;
}

const Counter: Model<ICounterDocument> =
  mongoose.models.Counter || mongoose.model<ICounterDocument>('Counter', CounterSchema);

export default Counter;
