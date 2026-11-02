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

  try {
    const body = await req.json();
    const { guest, items, paymentMethod, discountNote, discount } = body;

    // 1. Validate guest data
    if (!guest || !guest.name || !guest.lastName || !guest.phone) {
      return badRequest('BAD_REQUEST', 'Los datos del cliente son obligatorios.');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return badRequest('BAD_REQUEST', 'La venta debe incluir al menos un producto.');
    }

    // 2. Server-side wholesale threshold evaluation
    const totalPairs = items.reduce((sum: number, item: { qty: number }) => {
      return sum + Math.max(1, Number(item.qty));
    }, 0);
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
      const itemQty = Math.max(1, Number(item.qty));

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
      if (item.unitPrice !== undefined && item.unitPrice !== null) {
        unitPrice = Number(item.unitPrice);
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

    const appliedDiscount = Math.max(0, Number(discount ?? 0));
    const total = Math.max(0, calculatedSubtotal - appliedDiscount);
    const recordedPaymentMethod = ['transferencia', 'efectivo', 'tarjeta', 'otro'].includes(paymentMethod)
      ? paymentMethod
      : 'efectivo';
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
              guest: {
                name: guest.name.trim(),
                lastName: guest.lastName.trim(),
                phone: guest.phone.trim(),
              },
              items: storedItems,
              subtotal: calculatedSubtotal,
              discount: appliedDiscount,
              total,
              paymentMethod: recordedPaymentMethod,
              status: 'autorizado' as const,
              notes: discountNote ? discountNote.trim() : '',
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
              appliedDiscountNote: discountNote ?? '',
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

    console.error('Error al registrar venta directa:', error);
    const message = error instanceof Error && error.message ? error.message : 'Error al registrar la venta directa.';
    return NextResponse.json({ ok: false, error: 'INTERNAL_SERVER_ERROR', message }, { status: 500 });
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
