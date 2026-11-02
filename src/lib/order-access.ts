import { Types, type QueryFilter } from 'mongoose';
import { isObjectIdString } from '@/lib/input-validation';
import { isAdminRole } from '@/lib/permissions';
import { LEGACY_SELLER_KEY, WEB_SELLER_KEY } from '@/lib/seller-label';
import type { Session } from '@/lib/session';
import type { IOrder } from '@/models/Order';

const CANCELLED = new Set(['cancelado', 'cancelada']);

export function isCancelledStatus(status?: string): boolean {
  return CANCELLED.has(status ?? '');
}

/**
 * Which orders a session may see.
 * - seller: always only their own (`soldBy.userId`); `userFilter` is ignored, so a
 *   query parameter can never widen it.
 * - admin/superadmin: everything by default; `'web'` -> web orders; `'legacy'` ->
 *   direct sales recorded before attribution (`admin_direct` without `soldBy`); a
 *   valid ObjectId string -> orders sold by that user; any other value is ignored.
 * - any other role: nothing (fail closed).
 */
export function ordersScope(session: Session, userFilter?: string): QueryFilter<IOrder> {
  if (session.role === 'seller') {
    return { 'soldBy.userId': new Types.ObjectId(session.id) };
  }
  if (!isAdminRole(session.role)) {
    return { _id: { $exists: false } };
  }
  if (userFilter === WEB_SELLER_KEY) return { origin: 'web' };
  if (userFilter === LEGACY_SELLER_KEY) {
    return { origin: 'admin_direct', 'soldBy.userId': { $exists: false } };
  }
  if (isObjectIdString(userFilter)) return { 'soldBy.userId': new Types.ObjectId(userFilter) };
  return {};
}

/**
 * Whether the session may edit/cancel this order (and move it to `nextStatus`).
 * Admins may mutate any order (status rules are applied by the handlers). A
 * seller only their own direct sale (`admin_direct`, `soldBy.userId` = them)
 * whose status is exactly `autorizado`, and never to completada.
 */
export function canMutateOrder(
  session: Session,
  order: Pick<IOrder, 'origin' | 'status' | 'soldBy'>,
  nextStatus?: string
): boolean {
  if (isAdminRole(session.role)) return true;
  if (session.role !== 'seller') return false;
  if (order.origin !== 'admin_direct') return false;
  if (!order.soldBy?.userId || String(order.soldBy.userId) !== session.id) return false;
  if (order.status !== 'autorizado') return false;
  if (nextStatus === 'completada') return false;
  return true;
}
