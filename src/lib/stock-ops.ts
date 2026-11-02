import { Types, type ClientSession } from 'mongoose';
import Product from '@/models/Product';
import { getNextSequence } from '@/models/Counter';

/**
 * One stock movement. `qty` > 0 takes units out of stock (a sale), `qty` < 0
 * puts them back (a restock, e.g. an edited or cancelled order). The target is
 * the variant matched by `variantId` (preferred) or `variantName`; without
 * either, the legacy product-level `stock` field is used.
 */
export interface StockDelta {
  productId: string;
  variantId?: string;
  variantName?: string;
  qty: number;
}

export class InsufficientStockError extends Error {
  readonly item: StockDelta;
  readonly available: number;

  constructor(item: StockDelta, available: number, productName?: string, variantName?: string) {
    const label =
      item.variantId || item.variantName ? `Variante ${item.variantName ?? variantName ?? item.variantId}` : 'Stock general';
    super(
      `Stock insuficiente para "${productName ?? item.productId}" (${label}). ` +
        `Disponible: ${available}, Requerido: ${item.qty}.`
    );
    this.name = 'InsufficientStockError';
    this.item = item;
    this.available = available;
  }
}

type VariantMatch = { _id: Types.ObjectId } | { name: string };

interface Target {
  productId: Types.ObjectId;
  variant: VariantMatch | null;
}

function describeVariant(d: StockDelta): string {
  return d.variantName ?? d.variantId ?? '';
}

function resolveTarget(d: StockDelta): Target {
  if (!Number.isInteger(d.qty)) {
    throw new Error(`Cantidad (qty) inválida para el producto "${d.productId}": ${d.qty}`);
  }
  if (!Types.ObjectId.isValid(d.productId)) {
    throw new Error(`Producto "${d.productId}" no encontrado`);
  }
  if (d.variantId && !Types.ObjectId.isValid(d.variantId)) {
    throw new Error(`Variante "${d.variantId}" no encontrada en el producto "${d.productId}"`);
  }
  const variant: VariantMatch | null = d.variantId
    ? { _id: new Types.ObjectId(d.variantId) }
    : d.variantName
      ? { name: d.variantName }
      : null;
  return { productId: new Types.ObjectId(d.productId), variant };
}

/**
 * Filter for one `$inc`. When `minStock` is given the `$gte` guard sits in the
 * same filter as the update, so check-and-decrement is a single atomic write.
 * `$elemMatch` is required: with dotted paths (`variants._id` and
 * `variants.stock`) the two conditions could be satisfied by different array
 * elements, and the positional `$` would then point at the wrong variant.
 */
function stockFilter(t: Target, minStock?: number) {
  const guard = minStock !== undefined ? { stock: { $gte: minStock } } : {};
  if (t.variant) {
    return { _id: t.productId, variants: { $elemMatch: { ...t.variant, ...guard } } };
  }
  return { _id: t.productId, ...guard };
}

function stockPath(t: Target): 'variants.$.stock' | 'stock' {
  return t.variant ? 'variants.$.stock' : 'stock';
}

/**
 * Applies `-qty` to the target; decrements are guarded. Returns the target that
 * was actually written (null when nothing matched). Variant names are not
 * unique, so for a name match the pre-image is read in the same atomic
 * operation and the target is pinned to the `_id` of the element the positional
 * `$` updated (the first element satisfying the `$elemMatch`). Compensation then
 * reverts exactly that element.
 */
async function incStock(t: Target, qty: number, session: ClientSession | null): Promise<Target | null> {
  const minStock = qty > 0 ? qty : undefined;
  const filter = stockFilter(t, minStock);
  const update = { $inc: { [stockPath(t)]: -qty } };
  const opts = session ? { session } : {};

  if (t.variant && 'name' in t.variant) {
    const name = t.variant.name;
    const before = await Product.findOneAndUpdate(filter, update, {
      ...opts,
      returnDocument: 'before',
      projection: { 'variants._id': 1, 'variants.name': 1, 'variants.stock': 1 },
    }).lean<{ variants?: Array<{ _id?: Types.ObjectId; name?: string; stock?: number }> }>();
    if (!before) return null;
    const hit = (before.variants ?? []).find(
      (v) => v.name === name && (minStock === undefined || (v.stock ?? 0) >= minStock)
    );
    return hit?._id ? { productId: t.productId, variant: { _id: hit._id } } : t;
  }

  const res = await Product.updateOne(filter, update, opts);
  return res.matchedCount === 1 ? t : null;
}

/** Explains a failed update: unknown product/variant (Error) or not enough stock. */
async function failureFor(d: StockDelta, t: Target, session: ClientSession | null): Promise<Error> {
  const query = Product.findById(t.productId).select('name stock variants._id variants.name variants.stock').lean();
  const product = await (session ? query.session(session) : query);
  if (!product) {
    return new Error(`Producto "${d.productId}" no encontrado`);
  }
  if (!t.variant) {
    return new InsufficientStockError(d, Math.max(0, product.stock ?? 0), product.name);
  }
  const match = t.variant;
  const variant = (product.variants ?? []).find((v) =>
    '_id' in match ? String(v._id) === String(match._id) : v.name === match.name
  );
  if (!variant) {
    return new Error(`Variante "${describeVariant(d)}" no encontrada en el producto "${d.productId}"`);
  }
  return new InsufficientStockError(d, Math.max(0, variant.stock ?? 0), product.name, variant.name);
}

/**
 * Server-side recomputation of the stored `totalStock`, mirroring
 * `calculateDerivedProductFields` (sum of max(0, stock) over variants whose
 * `active` is not false) and the legacy rule `totalStock = stock` for products
 * without variants. Being a pipeline update it reads and writes the document in
 * one atomic step, so concurrent sales cannot leave a stale total behind.
 */
const TOTAL_STOCK_EXPR = {
  $cond: [
    { $gt: [{ $size: { $ifNull: ['$variants', []] } }, 0] },
    {
      $sum: {
        $map: {
          input: { $filter: { input: '$variants', as: 'v', cond: { $ne: ['$$v.active', false] } } },
          as: 'v',
          in: { $max: [0, { $ifNull: ['$$v.stock', 0] }] },
        },
      },
    },
    { $max: [0, { $ifNull: ['$stock', 0] }] },
  ],
};

async function recomputeTotalStock(ids: Types.ObjectId[], session: ClientSession | null): Promise<void> {
  if (ids.length === 0) return;
  await Product.updateMany(
    { _id: { $in: ids } },
    [{ $set: { totalStock: TOTAL_STOCK_EXPR } }],
    { ...(session ? { session } : {}), updatePipeline: true }
  );
}

/**
 * Applies all deltas or none.
 *
 * - With `session` (replica set): every write joins the caller's transaction;
 *   on failure this throws and the caller aborts. It never commits or aborts
 *   the session itself. Concurrent transactions touching the same product get
 *   a transient WriteConflict, which is rethrown untouched so the caller's
 *   `session.withTransaction` can retry.
 * - Without `session` (standalone): each write is atomic on its own; on failure
 *   the already-applied deltas are reverted once each with compensating `$inc`
 *   (best effort, see `compensate`) and the original error is rethrown.
 *
 * On success, `totalStock` of every touched product is recomputed (a failure
 * of that recompute is treated like any other failure).
 *
 * Caller obligations:
 * - Pass `variantId` for products with variants; without a variant the legacy
 *   product-level `stock` is used. `variantName` is a fallback (names are not
 *   unique; the first matching element with enough stock is used).
 * - On a replica set (the production path) wrap the call in
 *   `session.withTransaction(...)`, or retry on `TransientTransactionError`:
 *   concurrent sales of the same product conflict and one is retried.
 * - Standalone (local dev only) gives no isolation: while a failing batch is
 *   being compensated, its temporary decrements are visible, so a concurrent
 *   batch (e.g. the same items in the opposite order) can be rejected
 *   spuriously. It never oversells and never loses units through compensation.
 * - `qty: 0` writes nothing but still throws for an unknown product/variant.
 */
export async function applyStockDeltas(deltas: StockDelta[], session?: ClientSession | null): Promise<void> {
  const s = session ?? null;
  // Validate everything before the first write.
  const targets = deltas.map(resolveTarget);
  const applied: Array<{ target: Target; qty: number }> = [];
  const touched = new Map<string, Types.ObjectId>();

  try {
    for (let i = 0; i < deltas.length; i++) {
      const d = deltas[i];
      const t = targets[i];
      if (d.qty === 0) {
        // qty 0 writes nothing, but an unknown product/variant is still a
        // caller bug and is reported like any other delta.
        const q = Product.exists(stockFilter(t));
        if (!(await (s ? q.session(s) : q))) throw await failureFor(d, t, s);
        continue;
      }
      const written = await incStock(t, d.qty, s);
      if (!written) {
        throw await failureFor(d, t, s);
      }
      applied.push({ target: written, qty: d.qty });
      touched.set(String(t.productId), t.productId);
    }
    await recomputeTotalStock([...touched.values()], s);
  } catch (err) {
    // Replica set: the caller aborts the transaction. Standalone: revert every
    // applied delta, including when only the final recompute failed.
    if (!s) {
      await compensate(applied);
      await recomputeTotalStock([...touched.values()], null).catch((e) =>
        console.error('[stock-ops] No se pudo recalcular totalStock tras revertir:', e)
      );
    }
    throw err;
  }
}

/**
 * Reverts applied deltas, newest first, exactly once each (the list is walked
 * a single time and never retried, so no item is compensated twice). Undoing a
 * sale is an unguarded `+qty`. Undoing a restock takes the units back with a
 * `$gte` guard, so it can fail if they were sold meanwhile; that and any
 * driver error are logged and never replace the original error.
 */
async function compensate(applied: Array<{ target: Target; qty: number }>): Promise<void> {
  for (const { target, qty } of [...applied].reverse()) {
    try {
      const written = await incStock(target, -qty, null);
      if (!written) {
        console.error('[stock-ops] Compensación no aplicada', { productId: String(target.productId), qty });
      }
    } catch (e) {
      console.error('[stock-ops] Error al compensar stock', { productId: String(target.productId), qty }, e);
    }
  }
}

/**
 * Collision-free order number: `PED-<year>-N<seq>`, where `seq` comes from an
 * atomic per-year counter (`order-number-<year>`, first value 1001).
 *
 * Legacy numbers were `PED-<year>-<count+1 padded to 4><2 random digits>`, i.e.
 * only digits after the prefix. The `N` marker guarantees the new series can
 * never equal a legacy number, whatever the counter grows to.
 */
export async function nextOrderNumber(session?: ClientSession | null): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`order-number-${year}`, session ?? undefined);
  return `PED-${year}-N${seq}`;
}
