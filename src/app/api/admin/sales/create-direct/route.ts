import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getSession, sessionError } from '@/lib/session';
import { applyStockDeltas, InsufficientStockError, nextOrderNumber, type StockDelta } from '@/lib/stock-ops';
import { createdEntry } from '@/lib/order-history';
import { resolveListPrice, WHOLESALE_THRESHOLD } from '@/lib/pricing';
import Order from '@/models/Order';
import Product from '@/models/Product';
import SalesRecord from '@/models/SalesRecord';
import mongoose, { Types, type ClientSession } from 'mongoose';

/** Validated order line, ready to be stored on the Order. */
interface SaleLine {
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  sku?: string;
  name: string;
  image: string;
  variantLabel?: string;
  variantName?: string;
  qty: number;
  listPrice: number;
  appliedPriceType: 'retail' | 'wholesale' | 'custom';
  unitPrice: number;
  subtotal: number;
  /** Label used in the insufficient-stock message (not stored). */
  stockLabel: string;
}

/** One stock movement per product/variant, with what the error message needs. */
interface SaleDelta {
  delta: StockDelta;
  productName: string;
  label: string;
}

function isReplicaSet(): boolean {
  const client = mongoose.connection?.getClient() as unknown as {
    topology?: { description?: { type?: unknown } };
  };
  const topologyType = client?.topology?.description?.type;
  return typeof topologyType === 'string' && topologyType.includes('ReplicaSet');
}

function badRequest(error: string, message: string) {
  return NextResponse.json({ ok: false, error, message }, { status: 400 });
}

const PAYMENT_METHODS = ['transferencia', 'efectivo', 'tarjeta', 'otro'] as const;

/** Largest quantity accepted on one line. */
const MAX_LINE_QTY = 10000;

interface SaleInputItem {
  productId: string;
  variantId?: string;
  variantName?: string;
  sku?: string;
  variantLabel?: string;
  qty: number;
  /** Custom price; undefined when the client sent none (null/undefined). */
  unitPrice?: number;
}

interface SaleInput {
  guest: { name: string; lastName: string; phone: string };
  items: SaleInputItem[];
  paymentMethod: unknown;
  discount: number;
  discountNote: string;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Numbers, or strings holding one (the POS historically accepted "2"); anything else is NaN. */
function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
}

/** Only a 24-hex string is an id; objects such as {"$ne": null} never reach a query. */
function isObjectIdString(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v) && mongoose.isValidObjectId(v);
}

function optionalString(v: unknown): { ok: boolean; value?: string } {
  if (v === undefined || v === null) return { ok: true };
  return typeof v === 'string' ? { ok: true, value: v } : { ok: false };
}

function parseItem(item: unknown, n: number): Parsed<SaleInputItem> {
  const fail = (message: string): Parsed<SaleInputItem> => ({ ok: false, response: badRequest('BAD_REQUEST', message) });
  if (!isPlainObject(item)) return fail(`La línea ${n} de la venta no es válida.`);

  if (!isObjectIdString(item.productId)) return fail(`Producto inválido en la línea ${n}.`);

  let variantId: string | undefined;
  if (item.variantId !== undefined && item.variantId !== null) {
    if (!isObjectIdString(item.variantId)) return fail(`Variante inválida en la línea ${n}.`);
    variantId = String(item.variantId);
  }

  const variantName = optionalString(item.variantName);
  const sku = optionalString(item.sku);
  const variantLabel = optionalString(item.variantLabel);
  if (!variantName.ok || !sku.ok || !variantLabel.ok) return fail(`Datos inválidos en la línea ${n}.`);

  const qty = toNumber(item.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_LINE_QTY) {
    return fail(`Cantidad inválida en la línea ${n}: debe ser un número entero entre 1 y ${MAX_LINE_QTY}.`);
  }

  let unitPrice: number | undefined;
  if (item.unitPrice !== undefined && item.unitPrice !== null) {
    unitPrice = toNumber(item.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return fail(`Precio inválido en la línea ${n}: debe ser un número mayor o igual a 0.`);
    }
  }

  return {
    ok: true,
    value: {
      productId: String(item.productId),
      variantId,
      variantName: variantName.value,
      sku: sku.value,
      variantLabel: variantLabel.value,
      qty,
      unitPrice,
    },
  };
}

/**
 * Validates and normalizes the request body (types, ids, quantities, prices,
 * trimming). Runs before any stock or transaction work, so a malformed field
 * can never fail after stock was taken. Messages never echo raw input.
 */
function parseSaleInput(body: unknown): Parsed<SaleInput> {
  const fail = (message: string): Parsed<SaleInput> => ({ ok: false, response: badRequest('BAD_REQUEST', message) });
  if (!isPlainObject(body)) return fail('El cuerpo de la solicitud no es válido.');

  const g = body.guest;
  if (!isPlainObject(g) || !g.name || !g.lastName || !g.phone) {
    return fail('Los datos del cliente son obligatorios.');
  }
  if (typeof g.name !== 'string' || typeof g.lastName !== 'string' || typeof g.phone !== 'string') {
    return fail('Los datos del cliente no son válidos.');
  }
  const guest = { name: g.name.trim(), lastName: g.lastName.trim(), phone: g.phone.trim() };
  if (!guest.name || !guest.lastName || !guest.phone) {
    return fail('Los datos del cliente son obligatorios.');
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return fail('La venta debe incluir al menos un producto.');
  }
  const items: SaleInputItem[] = [];
  for (let i = 0; i < body.items.length; i++) {
    const parsed = parseItem(body.items[i], i + 1);
    if (!parsed.ok) return parsed;
    items.push(parsed.value);
  }

  let discount = 0;
  if (body.discount !== undefined && body.discount !== null && body.discount !== '') {
    discount = toNumber(body.discount);
    if (!Number.isFinite(discount) || discount < 0) {
      return fail('El descuento debe ser un número mayor o igual a 0.');
    }
  }

  const note = optionalString(body.discountNote);
  if (!note.ok) return fail('La nota de descuento no es válida.');

  return {
    ok: true,
    value: { guest, items, paymentMethod: body.paymentMethod, discount, discountNote: (note.value ?? '').trim() },
  };
}

/**
 * Sums the lines per stock target, so two lines of the same variant are
 * checked against the stock together.
 */
function buildDeltas(lines: SaleLine[]): SaleDelta[] {
  const byTarget = new Map<string, SaleDelta>();
  for (const line of lines) {
    const productId = String(line.productId);
    const variantId = line.variantId ? String(line.variantId) : undefined;
    const key = `${productId}:${variantId ?? ''}`;
    const existing = byTarget.get(key);
    if (existing) {
      existing.delta.qty += line.qty;
    } else {
      byTarget.set(key, {
        delta: { productId, ...(variantId ? { variantId } : {}), qty: line.qty },
        productName: line.name,
        label: line.stockLabel,
      });
    }
  }
  return [...byTarget.values()];
}

/**
 * POST /api/admin/sales/create-direct
 * Creates a direct sale from the POS panel (any active role: superadmin, admin, seller).
 * - Saved directly as 'autorizado' with origin 'admin_direct', attributed to the
 *   session user (`soldBy`, never taken from the body), with a 'created' history entry.
 * - Stock is decremented with a guarded atomic update (`applyStockDeltas`); not
 *   enough stock -> 409 and nothing is written.
 * - Replica set: stock, order number, Order and SalesRecord are written in one
 *   transaction (retried on transient conflicts). Standalone (local dev): stock
 *   and the Order are reverted if a later step fails.
 */
export async function POST(req: NextRequest) {
  await connectToDatabase();

  const user = await getSession(req);
  if (!user) return sessionError(401);

  let deltas: SaleDelta[] = [];

  // 1. Validate the whole body before any stock or transaction work.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest('BAD_REQUEST', 'El cuerpo de la solicitud no es válido.');
  }
  const parsed = parseSaleInput(raw);
  if (!parsed.ok) return parsed.response;
  const { guest, items, paymentMethod, discount: appliedDiscount, discountNote } = parsed.value;

  try {
    // 2. Server-side wholesale threshold evaluation
    const totalPairs = items.reduce((sum, item) => sum + item.qty, 0);
    const isWholesale = totalPairs >= WHOLESALE_THRESHOLD;

    // 3. Build validated items resolving prices from DB (before any write; the
    //    stock itself is checked atomically by applyStockDeltas).
    const lines: SaleLine[] = [];
    let calculatedSubtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);

      if (!product || !product.active) {
        return badRequest('PRODUCT_NOT_FOUND', `Producto con ID "${item.productId}" no disponible.`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let matchedVariant: any = null;
      let label = '';
      let variantRequested = false;

      if (item.variantId && product.variants && product.variants.length > 0) {
        variantRequested = true;
        matchedVariant = product.variants.find((v) => v._id?.toString() === item.variantId?.toString());
        label = item.variantLabel || `Variante ${item.variantId}`;
      } else if (item.variantName && product.variants && product.variants.length > 0) {
        variantRequested = true;
        matchedVariant = product.variants.find((v) => v.name === item.variantName);
        label = `Variante ${item.variantName}`;
      } else {
        label = 'Stock general';
      }
      const itemQty = item.qty;

      // A requested variant that does not exist has no stock (as before).
      if (variantRequested && !matchedVariant) {
        return NextResponse.json(
          {
            ok: false,
            error: 'INSUFFICIENT_STOCK',
            message: `Stock insuficiente para "${product.name}" (${label}). Disponible: 0, Requerido: ${itemQty}.`,
          },
          { status: 409 }
        );
      }

      const vRetail = Number(matchedVariant?.retailPrice ?? product.retailPrice ?? product.price ?? 0);
      const vWholesale = Number(matchedVariant?.wholesalePrice ?? product.wholesalePrice ?? vRetail);
      // Catalog list price by the normal rules, ignoring any manual override.
      const listPrice = resolveListPrice({ retail: vRetail, wholesale: vWholesale }, totalPairs).price;

      // Use custom price if explicitly set, otherwise the catalog / variant price.
      let unitPrice: number;
      let appliedPriceType: 'retail' | 'wholesale' | 'custom';
      if (item.unitPrice !== undefined) {
        unitPrice = item.unitPrice;
        appliedPriceType = 'custom';
      } else {
        unitPrice = listPrice;
        appliedPriceType = isWholesale ? 'wholesale' : 'retail';
      }

      const itemSubtotal = unitPrice * itemQty;
      calculatedSubtotal += itemSubtotal;

      const principalImage =
        product.images?.find((img) => img.isPrincipal)?.url || product.images?.[0]?.url || '';

      lines.push({
        productId: product._id as Types.ObjectId,
        variantId: matchedVariant?._id,
        sku: matchedVariant?.sku || item.sku,
        name: product.name,
        image: principalImage,
        variantLabel: item.variantLabel || item.variantName,
        variantName: item.variantName,
        qty: itemQty,
        listPrice,
        appliedPriceType,
        unitPrice,
        subtotal: itemSubtotal,
        stockLabel: label,
      });
    }

    deltas = buildDeltas(lines);

    if (appliedDiscount > calculatedSubtotal) {
      return badRequest('BAD_REQUEST', 'El descuento no puede superar el subtotal.');
    }
    const total = Math.max(0, calculatedSubtotal - appliedDiscount);
    const recordedPaymentMethod = PAYMENT_METHODS.find((m) => m === paymentMethod) ?? 'efectivo';
    const soldBy = { userId: new Types.ObjectId(user.id), username: user.username, name: user.name };
    const history = [createdEntry({ id: user.id, name: user.name }, total)];
    const storedItems = lines.map((line) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { stockLabel, ...stored } = line;
      return stored;
    });

    /**
     * Writes the whole sale. Idempotent per attempt: everything is built from
     * the values above, so `withTransaction` may re-run it after a conflict.
     * Without a session (standalone) `applyStockDeltas` reverts its own partial
     * writes, and a later failure returns the stock and removes the Order here.
     */
    const writeSale = async (session: ClientSession | null) => {
      const opts = session ? { session } : {};
      await applyStockDeltas(
        deltas.map((d) => d.delta),
        session
      );
      let orderId: Types.ObjectId | undefined;
      try {
        const orderNumber = await nextOrderNumber(session);
        const [order] = await Order.create(
          [
            {
              orderNumber,
              origin: 'admin_direct' as const,
              guest,
              items: storedItems,
              subtotal: calculatedSubtotal,
              discount: appliedDiscount,
              total,
              paymentMethod: recordedPaymentMethod,
              status: 'autorizado' as const,
              notes: discountNote,
              soldBy,
              history,
            },
          ],
          opts
        );
        orderId = order._id as Types.ObjectId;
        const [salesRecord] = await SalesRecord.create(
          [
            {
              orderId: order._id,
              orderNumber: order.orderNumber,
              confirmationDate: new Date(),
              recordedPaymentMethod: order.paymentMethod,
              appliedDiscountNote: discountNote,
              finalTotal: total,
              soldBy,
            },
          ],
          opts
        );
        return { order, salesRecord };
      } catch (err) {
        if (!session) await undoStandaloneSale(deltas, orderId);
        throw err;
      }
    };

    let result: Awaited<ReturnType<typeof writeSale>> | undefined;
    const session = isReplicaSet() ? await mongoose.startSession().catch(() => null) : null;

    if (session) {
      try {
        await session.withTransaction(async () => {
          result = await writeSale(session);
        });
      } finally {
        await session.endSession().catch(() => {});
      }
    } else {
      result = await writeSale(null);
    }

    const { order: newOrder, salesRecord } = result!;
    return NextResponse.json(
      {
        ok: true,
        message: 'Venta directa registrada y stock actualizado.',
        orderId: newOrder._id.toString(),
        orderNumber: newOrder.orderNumber,
        salesRecordId: salesRecord._id.toString(),
        total,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof InsufficientStockError) {
      const info = deltas.find((d) => d.delta === error.item);
      const name = info?.productName ?? error.item.productId;
      const label = info?.label ?? 'Stock general';
      return NextResponse.json(
        {
          ok: false,
          error: 'INSUFFICIENT_STOCK',
          message: `Stock insuficiente para "${name}" (${label}). Disponible: ${error.available}, Requerido: ${error.item.qty}.`,
        },
        { status: 409 }
      );
    }

    // Never expose driver/cast error text (ids, collection names) to the client.
    console.error('Error al registrar venta directa:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al registrar la venta directa.' },
      { status: 500 }
    );
  }
}

/**
 * Standalone only (no transactions): best-effort undo after the stock was taken
 * but a later step failed. Errors are logged and never replace the original one.
 */
async function undoStandaloneSale(deltas: SaleDelta[], orderId?: Types.ObjectId): Promise<void> {
  if (orderId) {
    await Order.deleteOne({ _id: orderId }).catch((e) =>
      console.error('[create-direct] No se pudo eliminar el pedido tras el error:', e)
    );
  }
  await applyStockDeltas(deltas.map((d) => ({ ...d.delta, qty: -d.delta.qty }))).catch((e) =>
    console.error('[create-direct] No se pudo devolver el stock tras el error:', e)
  );
}
