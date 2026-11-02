import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getSession, sessionError } from '@/lib/session';
import { isAdminRole } from '@/lib/permissions';
import { diffOrder } from '@/lib/order-history';
import { runInTransaction } from '@/lib/transaction';
import { isObjectIdString, isPlainObject, optionalString, toNumber } from '@/lib/input-validation';
import {
  applyThenWrite,
  jsonError,
  mutationErrorResponse,
  orderNotFound,
  orderSnapshot,
  OrderHttpError,
  statusTransitionDeltas,
  writeOrderIfUnchanged,
  type ItemDelta,
} from '@/lib/order-mutation';
import Order from '@/models/Order';
import SalesRecord from '@/models/SalesRecord';

const PAYMENT_REQUIRED = 'El medio de pago registrado es obligatorio.';
const PAYMENT_METHODS = ['efectivo', 'transferencia', 'tarjeta', 'otro'] as const;

/**
 * POST /api/admin/orders/:id/authorize  (admin/superadmin only; sellers -> 403)
 * Authorizes a pending order:
 * 1. Takes the stock of every item with the guarded atomic update
 *    (`applyStockDeltas`): missing product -> 409 PRODUCT_NOT_FOUND, not enough
 *    stock -> 409 INSUFFICIENT_STOCK, nothing written.
 * 2. Moves the order to 'autorizado' (only if it is still 'pendiente', so two
 *    concurrent authorizations cannot both take stock) and appends history.
 * 3. Creates the SalesRecord.
 * Replica set: one transaction. Standalone: stock and order are reverted if a
 * later step fails.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const user = await getSession(req);
  if (!user) return sessionError(401);
  if (!isAdminRole(user.role)) return sessionError(403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'El cuerpo de la solicitud no es válido.');
  }
  const { recordedPaymentMethod, discountNote, finalTotal } = isPlainObject(body) ? body : ({} as Record<string, unknown>);

  if (!recordedPaymentMethod) {
    return jsonError(400, 'BAD_REQUEST', PAYMENT_REQUIRED);
  }
  // Any other value failed the SalesRecord schema before (500); now a clear 400.
  const paymentMethod = PAYMENT_METHODS.find((m) => m === recordedPaymentMethod);
  if (!paymentMethod) return jsonError(400, 'BAD_REQUEST', 'El medio de pago registrado no es válido.');
  const note = optionalString(discountNote);
  if (!note.ok) return jsonError(400, 'BAD_REQUEST', 'La nota de descuento no es válida.');
  let resolvedFinal: number | undefined;
  if (finalTotal !== undefined) {
    resolvedFinal = toNumber(finalTotal);
    if (!Number.isFinite(resolvedFinal) || resolvedFinal < 0) {
      return jsonError(400, 'BAD_REQUEST', 'El total final debe ser un número mayor o igual a 0.');
    }
  }

  const { id } = await params;
  if (!isObjectIdString(id)) return jsonError(404, 'NOT_FOUND', 'Solicitud no encontrada.');
  const actor = { id: user.id, name: user.name };

  let deltas: ItemDelta[] = [];
  try {
    const result = await runInTransaction(async (session) => {
      deltas = [];
      const opts = session ? { session } : {};
      const query = Order.findById(id);
      const order = await (session ? query.session(session) : query);
      if (!order) throw orderNotFound('Solicitud no encontrada.');

      if (order.status !== 'pendiente') {
        throw new OrderHttpError(
          409,
          'INVALID_STATUS',
          `Solo se pueden autorizar órdenes en estado "pendiente". Estado actual: "${order.status}".`
        );
      }

      deltas = await statusTransitionDeltas(order.status, 'autorizado', order.items, session);

      const before = orderSnapshot(order);
      const history = diffOrder(before, { ...before, status: 'autorizado' }, actor);
      const set: Record<string, unknown> = { status: 'autorizado' };
      if (note.value) set.notes = note.value.trim();
      // Standalone revert restores exactly what was there: notes are only
      // touched if this write changed them, and unset again if they were unset.
      const revert: Record<string, unknown> = { $set: { status: order.status }, $pop: { history: 1 } };
      if ('notes' in set) {
        if (order.$isDefault('notes')) revert.$unset = { notes: '' };
        else (revert.$set as Record<string, unknown>).notes = order.notes;
      }

      return applyThenWrite(deltas, session, async () => {
        const updated = await writeOrderIfUnchanged(order, set, history, session);
        try {
          const [salesRecord] = await SalesRecord.create(
            [
              {
                orderId: updated._id,
                orderNumber: updated.orderNumber,
                confirmationDate: new Date(),
                recordedPaymentMethod: paymentMethod,
                appliedDiscountNote: note.value ?? '',
                finalTotal: resolvedFinal ?? updated.total,
              },
            ],
            opts
          );
          return { order: updated, salesRecord };
        } catch (err) {
          if (!session) {
            // Standalone: put the order back to pendiente (its history entry too).
            await Order.updateOne(
              { _id: updated._id, status: 'autorizado', updatedAt: updated.updatedAt },
              revert
            ).catch((e) => console.error('[authorize] No se pudo revertir la orden tras el error:', e));
          }
          throw err;
        }
      });
    });

    return NextResponse.json({
      ok: true,
      message: 'Venta autorizada exitosamente y stock actualizado.',
      salesRecordId: result.salesRecord._id.toString(),
      orderNumber: result.order.orderNumber,
    });
  } catch (error) {
    return mutationErrorResponse(error, deltas, 'Error al autorizar orden:', 'Error al autorizar la venta.');
  }
}
