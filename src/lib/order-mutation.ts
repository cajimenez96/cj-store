import { NextResponse } from 'next/server';
import mongoose, { type ClientSession, type Types } from 'mongoose';
import { applyStockDeltas, InsufficientStockError, type StockDelta } from '@/lib/stock-ops';
import type { HistoryEntry, OrderSnapshot } from '@/lib/order-history';
import Order, { type IOrderDocument } from '@/models/Order';
import Product from '@/models/Product';

/**
 * Shared machinery for the admin order mutations (edit, cancel, status change,
 * authorize): stock deltas computed from order items, the guarded order write,
 * standalone compensation and the Spanish `{ ok:false, error, message }` errors.
 */

/** An expected, user-facing failure; thrown inside a transaction to abort it. */
export class OrderHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'OrderHttpError';
  }
}

export function jsonError(status: number, error: string, message: string): NextResponse {
  return NextResponse.json({ ok: false, error, message }, { status });
}

/** Same body for a missing order and for one outside the caller's scope. */
export const ORDER_NOT_FOUND_MESSAGE = 'Solicitud no encontrada';

export function orderNotFound(message = ORDER_NOT_FOUND_MESSAGE): OrderHttpError {
  return new OrderHttpError(404, 'NOT_FOUND', message);
}

/** Statuses whose stock has already been taken (authorize/POS sale, or list PUT -> completada). */
const STOCK_HELD = new Set(['autorizado', 'completada']);

export function holdsStock(status: string): boolean {
  return STOCK_HELD.has(status);
}

/** The order fields an item-level stock movement needs. */
export interface StockItem {
  productId: Types.ObjectId | string;
  variantId?: Types.ObjectId | string;
  variantName?: string;
  variantLabel?: string;
  name: string;
  qty: number;
}

/** One stock movement plus what the insufficient-stock message needs. */
export interface ItemDelta {
  delta: StockDelta;
  name: string;
  label: string;
}

function stockLabel(item: StockItem): string {
  if (item.variantId) return item.variantLabel || `Variante ${String(item.variantId)}`;
  if (item.variantName) return `Variante ${item.variantName}`;
  return 'Stock general';
}

function targetKey(item: StockItem): string {
  const variant = item.variantId ? `id:${String(item.variantId)}` : item.variantName ? `name:${item.variantName}` : '';
  return `${String(item.productId)}|${variant}`;
}

interface DeltaOptions {
  /** Positive deltas for a product that no longer exists are skipped instead of failing. */
  skipMissing?: boolean;
}

/**
 * Net stock movement per product/variant to go from `before` to `after`
 * (positive takes stock, negative restocks); unchanged targets are dropped, so
 * no qty-0 delta ever reaches applyStockDeltas. Targets are resolved against
 * the catalog (in `session`):
 * - products with variants use the variant (`variantId`, else `variantName`);
 *   products without variants use the product-level stock;
 * - a missing product (or variant) cannot be restocked: the restock is skipped
 *   and logged, so an order whose product was deleted can still be cancelled;
 * - taking stock from a missing product -> 409 PRODUCT_NOT_FOUND, from a missing
 *   variant -> 409 INSUFFICIENT_STOCK with "Disponible: 0" (as authorize did).
 */
export async function itemDeltas(
  before: StockItem[],
  after: StockItem[],
  session: ClientSession | null,
  options: DeltaOptions = {}
): Promise<ItemDelta[]> {
  const net = new Map<string, { item: StockItem; qty: number }>();
  for (const [items, sign] of [
    [before, -1],
    [after, 1],
  ] as const) {
    for (const item of items) {
      const key = targetKey(item);
      const entry = net.get(key) ?? { item, qty: 0 };
      if (sign > 0) entry.item = item;
      entry.qty += sign * item.qty;
      net.set(key, entry);
    }
  }
  const moving = [...net.values()].filter((e) => e.qty !== 0);
  if (moving.length === 0) return [];

  const ids = [...new Set(moving.map((e) => String(e.item.productId)))];
  const query = Product.find({ _id: { $in: ids } })
    .select('name stock variants._id variants.name')
    .lean();
  const products = await (session ? query.session(session) : query);
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const out: ItemDelta[] = [];
  for (const { item, qty } of moving) {
    const productId = String(item.productId);
    const product = byId.get(productId);
    const label = stockLabel(item);
    if (!product) {
      if (qty > 0 && !options.skipMissing) {
        throw new OrderHttpError(409, 'PRODUCT_NOT_FOUND', `Producto "${item.name}" ya no existe en el catálogo.`);
      }
      console.warn('[orders] Producto inexistente, movimiento de stock omitido', { productId, qty });
      continue;
    }
    const variants = product.variants ?? [];
    if (variants.length === 0) {
      out.push({ delta: { productId, qty }, name: item.name, label });
      continue;
    }
    if (!item.variantId && !item.variantName) {
      // Legacy line without a variant: product-level stock, as before.
      out.push({ delta: { productId, qty }, name: item.name, label });
      continue;
    }
    const variant = item.variantId
      ? variants.find((v) => String(v._id) === String(item.variantId))
      : variants.find((v) => v.name === item.variantName);
    if (!variant?._id) {
      if (qty > 0 && !options.skipMissing) {
        throw new OrderHttpError(
          409,
          'INSUFFICIENT_STOCK',
          `Stock insuficiente para "${item.name}" (${label}). Disponible: 0, Requerido: ${qty}.`
        );
      }
      console.warn('[orders] Variante inexistente, movimiento de stock omitido', { productId, qty });
      continue;
    }
    out.push({ delta: { productId, variantId: String(variant._id), qty }, name: item.name, label });
  }
  return out;
}

/**
 * Applies the stock deltas, then runs `write` (the order write). With a session
 * both happen in the caller's transaction. Standalone: applyStockDeltas reverts
 * its own partial writes, and if `write` fails afterwards the deltas are
 * reverted here (once, best effort, logged) before the error is rethrown.
 */
export async function applyThenWrite<T>(
  deltas: ItemDelta[],
  session: ClientSession | null,
  write: () => Promise<T>
): Promise<T> {
  const stock = deltas.map((d) => d.delta);
  if (stock.length > 0) await applyStockDeltas(stock, session);
  try {
    return await write();
  } catch (err) {
    if (!session && stock.length > 0) {
      await applyStockDeltas(stock.map((d) => ({ ...d, qty: -d.qty }))).catch((e) =>
        console.error('[orders] No se pudo revertir el stock tras el error:', e)
      );
    }
    throw err;
  }
}

/**
 * Writes `set` and appends `history` only if the order is still exactly as it
 * was loaded (same status and `updatedAt`), so two concurrent mutations of one
 * order can never both succeed (e.g. a double cancel restocking twice). On a
 * replica set the transaction already isolates; this is the standalone guard.
 */
export async function writeOrderIfUnchanged(
  loaded: IOrderDocument,
  set: Record<string, unknown>,
  history: HistoryEntry[],
  session: ClientSession | null
): Promise<IOrderDocument> {
  const updated = await Order.findOneAndUpdate(
    { _id: loaded._id, status: loaded.status, updatedAt: loaded.updatedAt ?? null },
    { $set: set, ...(history.length > 0 ? { $push: { history: { $each: history } } } : {}) },
    { ...(session ? { session } : {}), returnDocument: 'after', runValidators: true }
  );
  if (!updated) {
    throw new OrderHttpError(
      409,
      'CONFLICT',
      'La solicitud fue modificada por otra operación. Actualiza e inténtalo de nuevo.'
    );
  }
  return updated;
}

/** What `diffOrder` compares. */
export function orderSnapshot(order: {
  items: Array<StockItem & { sku?: string; unitPrice: number }>;
  discount: number;
  paymentMethod: string;
  status: string;
}): OrderSnapshot {
  return {
    items: order.items.map((i) => ({
      productId: String(i.productId),
      variantId: i.variantId ? String(i.variantId) : undefined,
      sku: i.sku,
      variantName: i.variantName,
      name: i.name,
      variantLabel: i.variantLabel,
      qty: i.qty,
      unitPrice: i.unitPrice,
    })),
    discount: order.discount,
    paymentMethod: order.paymentMethod,
    status: order.status,
  };
}

/**
 * Maps a failure to the response: expected errors keep their status, not enough
 * stock -> 409 with the product/label message, a schema validation failure ->
 * 400, anything else -> 500 with `fallbackMessage` (details only in the log).
 */
export function mutationErrorResponse(
  err: unknown,
  deltas: ItemDelta[],
  logLabel: string,
  fallbackMessage: string
): NextResponse {
  if (err instanceof OrderHttpError) return jsonError(err.status, err.code, err.message);
  if (err instanceof InsufficientStockError) {
    const info = deltas.find((d) => d.delta === err.item);
    const name = info?.name ?? err.item.productId;
    const label = info?.label ?? 'Stock general';
    return jsonError(
      409,
      'INSUFFICIENT_STOCK',
      `Stock insuficiente para "${name}" (${label}). Disponible: ${err.available}, Requerido: ${err.item.qty}.`
    );
  }
  console.error(logLabel, err);
  if (err instanceof mongoose.Error.ValidationError) {
    return jsonError(400, 'BAD_REQUEST', 'Los datos de la solicitud no son válidos.');
  }
  return jsonError(500, 'INTERNAL_SERVER_ERROR', fallbackMessage);
}
