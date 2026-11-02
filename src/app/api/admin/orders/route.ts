import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getSession, sessionError } from '@/lib/session';
import { isAdminRole } from '@/lib/permissions';
import { isCancelledStatus, ordersScope } from '@/lib/order-access';
import { diffOrder } from '@/lib/order-history';
import { runInTransaction } from '@/lib/transaction';
import { escapeRegex, isObjectIdString, isPlainObject } from '@/lib/input-validation';
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
import { withProductImages } from '@/lib/order-items';
import Order from '@/models/Order';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/orders
 * Admins: every order, optionally `?userId=web|legacy|<userId>`. Sellers: only their
 * own orders; `userId` is ignored for them (forced from the session).
 */
export async function GET(req: NextRequest) {
  await connectToDatabase();
  const user = await getSession(req);
  if (!user) return sessionError(401);

  try {
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    // Invalid, zero or negative values fall back to the defaults (page 1, no limit).
    const parsedPage = pageParam ? parseInt(pageParam, 10) : NaN;
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const parsedLimit = limitParam !== null ? parseInt(limitParam, 10) : NaN;
    const hasPagination = Number.isFinite(parsedLimit) && parsedLimit > 0;
    const limit = hasPagination ? parsedLimit : 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    const VALID_STATUSES = ['pendiente', 'autorizado', 'cancelado', 'confirmada', 'completada', 'cancelada'];
    if (status && VALID_STATUSES.includes(status)) {
      query.status = status;
    }

    if (search) {
      // Plain, case-insensitive substring: metacharacters are escaped (no ReDoS, no invalid regex).
      const pattern = escapeRegex(search);
      query.$or = [
        { orderNumber: { $regex: pattern, $options: 'i' } },
        { 'guest.name': { $regex: pattern, $options: 'i' } },
        { 'guest.lastName': { $regex: pattern, $options: 'i' } },
        { 'guest.phone': { $regex: pattern, $options: 'i' } },
      ];
    }

    Object.assign(query, ordersScope(user, searchParams.get('userId') ?? undefined));

    const total = await Order.countDocuments(query);
    let orderQuery = Order.find(query)
      .sort({ createdAt: -1, _id: -1 });

    if (hasPagination) {
      const skip = (page - 1) * limit;
      orderQuery = orderQuery.skip(skip).limit(limit);
    }

    const orders = await orderQuery.lean();

    const formattedOrders = await withProductImages(orders);

    return NextResponse.json({
      ok: true,
      data: formattedOrders,
      pagination: {
        page,
        limit: hasPagination ? limit : total,
        total,
        totalPages: hasPagination && limit > 0 ? Math.ceil(total / limit) : 1,
      },
    });
  } catch (error) {
    console.error('Error al consultar solicitudes en admin:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar solicitudes' },
      { status: 500 }
    );
  }
}

const LIST_STATUSES = ['pendiente', 'completada', 'cancelada'];

/**
 * PUT /api/admin/orders  { id, status: 'pendiente'|'completada'|'cancelada', notes? }
 * Admin-only status change (sellers -> 403). Stock follows the single rule in
 * `order-mutation.ts` (`holdsStock`): moving into a holding status (completada)
 * from pendiente takes the order's units (guarded: short stock -> 409); moving
 * out of one (to pendiente or cancelada) restocks them once; autorizado <->
 * completada moves nothing. A cancelled order is final (409). Re-sending the
 * current status is a no-op for stock and history. Stock, status and history
 * are written together.
 */
export async function PUT(req: NextRequest) {
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
  const { id, status, notes } = isPlainObject(body) ? body : ({} as Record<string, unknown>);

  if (!id || !status || typeof status !== 'string' || !LIST_STATUSES.includes(status) || !isObjectIdString(id)) {
    return jsonError(400, 'BAD_REQUEST', 'ID y estado válido son obligatorios');
  }
  if (notes !== undefined && typeof notes !== 'string') {
    return jsonError(400, 'BAD_REQUEST', 'Las notas no son válidas.');
  }
  const actor = { id: user.id, name: user.name };

  let deltas: ItemDelta[] = [];
  try {
    const updated = await runInTransaction(async (session) => {
      deltas = [];
      const query = Order.findById(id);
      const order = await (session ? query.session(session) : query);
      if (!order) throw orderNotFound();

      const previousStatus = order.status;
      if (isCancelledStatus(previousStatus)) {
        throw new OrderHttpError(409, 'INVALID_STATUS', 'La orden está cancelada y no se puede modificar.');
      }

      // As before: a product that no longer exists is skipped, not an error.
      deltas = await statusTransitionDeltas(previousStatus, status, order.items, session, { skipMissing: true });

      const before = orderSnapshot(order);
      const history = diffOrder(before, { ...before, status }, actor);
      const set: Record<string, unknown> = { status };
      if (notes !== undefined) set.notes = notes.trim();

      return applyThenWrite(deltas, session, () => writeOrderIfUnchanged(order, set, history, session));
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return mutationErrorResponse(error, deltas, 'Error al actualizar estado de orden:', 'Error al actualizar la solicitud');
  }
}
