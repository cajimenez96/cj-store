import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getSession, sessionError, type Session } from '@/lib/session';
import { isAdminRole } from '@/lib/permissions';
import { canMutateOrder, isCancelledStatus, ordersScope } from '@/lib/order-access';
import { diffOrder } from '@/lib/order-history';
import { resolveListPrice } from '@/lib/pricing';
import { runInTransaction } from '@/lib/transaction';
import { isObjectIdString, isPlainObject, optionalString, toNumber } from '@/lib/input-validation';
import {
  applyThenWrite,
  holdsStock,
  itemDeltas,
  jsonError,
  mutationErrorResponse,
  ORDER_NOT_FOUND_MESSAGE,
  orderNotFound,
  orderSnapshot,
  OrderHttpError,
  writeOrderIfUnchanged,
  type ItemDelta,
} from '@/lib/order-mutation';
import Order, { type IOrderDocument, type IOrderItem } from '@/models/Order';
import Product from '@/models/Product';
import { Types, type ClientSession } from 'mongoose';

const notFoundResponse = () => jsonError(404, 'NOT_FOUND', ORDER_NOT_FOUND_MESSAGE);
const badRequest = (message: string) => jsonError(400, 'BAD_REQUEST', message);

/** Loads the order inside the caller's scope; out of scope is indistinguishable from missing. */
async function loadScopedOrder(id: string, user: Session, session: ClientSession | null): Promise<IOrderDocument> {
  const query = Order.findOne({ _id: id, ...ordersScope(user) });
  const order = await (session ? query.session(session) : query);
  if (!order) throw orderNotFound();
  return order;
}

/**
 * GET /api/admin/orders/:id
 * Admins see any order; a seller only their own (anything else is the same 404
 * as a missing order).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const user = await getSession(req);
  if (!user) return sessionError(401);

  try {
    const { id } = await params;
    if (!isObjectIdString(id)) return notFoundResponse();

    const order = await Order.findOne({ _id: id, ...ordersScope(user) })
      .populate('items.productId', 'images name')
      .lean();

    if (!order) return notFoundResponse();

    const formattedOrder = {
      ...order,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: ((order as any).items || []).map((item: any) => {
        const prod = item.productId && typeof item.productId === 'object' ? item.productId : null;
        const mainImage =
          item.image ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          prod?.images?.find((img: any) => img.isPrincipal)?.url ||
          prod?.images?.[0]?.url ||
          '';
        return {
          ...item,
          productId: prod?._id ? prod._id.toString() : item.productId?.toString() || '',
          image: mainImage,
        };
      }),
    };

    return NextResponse.json({ ok: true, data: formattedOrder });
  } catch (error) {
    console.error('Error al obtener orden:', error);
    return jsonError(500, 'INTERNAL_SERVER_ERROR', 'Error al consultar solicitud');
  }
}

// ---------------------------------------------------------------------------
// PUT: edit
// ---------------------------------------------------------------------------

const PAYMENT_METHODS = ['transferencia', 'efectivo', 'tarjeta', 'otro'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];
const PRICE_TYPES = ['retail', 'wholesale', 'custom'] as const;
type PriceType = (typeof PRICE_TYPES)[number];
/** Largest quantity accepted on one line (same as create-direct). */
const MAX_LINE_QTY = 10000;
const EDITABLE_STATUSES = ['pendiente', 'autorizado'];

interface EditItem {
  productId: string;
  variantId?: string;
  name: string;
  image?: string;
  variantLabel?: string;
  variantName?: string;
  sku?: string;
  qty: number;
  unitPrice: number;
  appliedPriceType: PriceType;
}

interface EditInput {
  guest?: { name?: string; lastName?: string; phone?: string };
  items?: EditItem[];
  discount?: number;
  notes?: string;
  paymentMethod?: PaymentMethod;
  /** Only used to refuse a seller asking for completada. */
  status?: string;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

function parseEditItem(item: unknown, n: number): Parsed<EditItem> {
  const fail = (message: string): Parsed<EditItem> => ({ ok: false, message });
  if (!isPlainObject(item)) return fail(`La línea ${n} de la solicitud no es válida.`);
  if (!isObjectIdString(item.productId)) return fail(`Producto inválido en la línea ${n}.`);

  let variantId: string | undefined;
  if (item.variantId !== undefined && item.variantId !== null && item.variantId !== '') {
    if (!isObjectIdString(item.variantId)) return fail(`Variante inválida en la línea ${n}.`);
    variantId = item.variantId;
  }
  if (typeof item.name !== 'string' || item.name.trim() === '') return fail(`Nombre inválido en la línea ${n}.`);

  const strings = ['image', 'variantLabel', 'variantName', 'sku'].map((k) => optionalString(item[k]));
  if (strings.some((s) => !s.ok)) return fail(`Datos inválidos en la línea ${n}.`);
  const [image, variantLabel, variantName, sku] = strings.map((s) => s.value);

  const qty = toNumber(item.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_LINE_QTY) {
    return fail(`Cantidad inválida en la línea ${n}: debe ser un número entero entre 1 y ${MAX_LINE_QTY}.`);
  }
  const unitPrice = toNumber(item.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return fail(`Precio inválido en la línea ${n}: debe ser un número mayor o igual a 0.`);
  }
  let appliedPriceType: PriceType = 'custom';
  if (item.appliedPriceType !== undefined && item.appliedPriceType !== null) {
    const t = PRICE_TYPES.find((p) => p === item.appliedPriceType);
    if (!t) return fail(`Tipo de precio inválido en la línea ${n}.`);
    appliedPriceType = t;
  }
  return {
    ok: true,
    value: { productId: item.productId, variantId, name: item.name, image, variantLabel, variantName, sku, qty, unitPrice, appliedPriceType },
  };
}

/** Strict validation of the edit body; runs before any read or write. */
function parseEditInput(body: unknown): Parsed<EditInput> {
  const fail = (message: string): Parsed<EditInput> => ({ ok: false, message });
  if (!isPlainObject(body)) return fail('El cuerpo de la solicitud no es válido.');
  const out: EditInput = {};

  if (body.guest !== undefined && body.guest !== null) {
    const g = body.guest;
    if (!isPlainObject(g)) return fail('Los datos del cliente no son válidos.');
    const fields = ['name', 'lastName', 'phone'].map((k) => optionalString(g[k]));
    if (fields.some((f) => !f.ok)) return fail('Los datos del cliente no son válidos.');
    const [name, lastName, phone] = fields.map((f) => f.value);
    out.guest = { name, lastName, phone };
  }

  if (body.items !== undefined && body.items !== null) {
    if (!Array.isArray(body.items)) return fail('Los productos de la solicitud no son válidos.');
    // An empty list leaves the items untouched (as before).
    if (body.items.length > 0) {
      const items: EditItem[] = [];
      for (let i = 0; i < body.items.length; i++) {
        const parsed = parseEditItem(body.items[i], i + 1);
        if (!parsed.ok) return parsed;
        items.push(parsed.value);
      }
      out.items = items;
    }
  }

  if (body.discount !== undefined) {
    // null / '' meant 0 before; anything else must be a finite number >= 0.
    const discount = body.discount === null || body.discount === '' ? 0 : toNumber(body.discount);
    if (!Number.isFinite(discount) || discount < 0) return fail('El descuento debe ser un número mayor o igual a 0.');
    out.discount = discount;
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') return fail('Las notas no son válidas.');
    out.notes = body.notes;
  }

  if (body.paymentMethod !== undefined && body.paymentMethod !== null && body.paymentMethod !== '') {
    const method = PAYMENT_METHODS.find((m) => m === body.paymentMethod);
    if (!method) return fail('El medio de pago no es válido.');
    out.paymentMethod = method;
  }

  if (typeof body.status === 'string') out.status = body.status;
  return { ok: true, value: out };
}

function lineKey(i: { productId: unknown; variantId?: unknown; variantName?: string }): string {
  return `${String(i.productId)}|${i.variantId ? String(i.variantId) : (i.variantName ?? '')}`;
}

/**
 * Builds the stored lines. The variant link is re-resolved against the
 * catalog (as before); `unitPrice` is kept as sent. Each line carries its
 * stored list price (if any) and, separately, the catalog list price for the
 * new total quantity, so the caller picks one once it knows whether
 * quantities changed.
 */
async function buildItems(
  input: EditItem[],
  previous: IOrderItem[],
  session: ClientSession | null
): Promise<Array<{ item: IOrderItem; catalogListPrice?: number }>> {
  const ids = [...new Set(input.map((i) => i.productId))];
  const query = Product.find({ _id: { $in: ids } }).lean();
  const products = await (session ? query.session(session) : query);
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const totalQty = input.reduce((sum, i) => sum + i.qty, 0);

  const storedListPrice = new Map<string, number[]>();
  for (const p of previous) {
    if (p.listPrice === undefined || p.listPrice === null) continue;
    const k = lineKey(p);
    storedListPrice.set(k, [...(storedListPrice.get(k) ?? []), p.listPrice]);
  }

  return input.map((item) => {
    const dbProd = productMap.get(item.productId);
    const dbVariant = item.variantId
      ? dbProd?.variants?.find((v) => v._id?.toString() === item.variantId)
      : undefined;
    if (item.variantId && !dbVariant) {
      throw new OrderHttpError(400, 'VARIANT_NOT_FOUND', `La variante de "${item.name}" ya no existe en el producto.`);
    }

    const listPrice: number | undefined = storedListPrice.get(lineKey(item))?.shift();
    let catalogListPrice: number | undefined;
    if (dbProd) {
      const nameVariant = !dbVariant && item.variantName
        ? dbProd.variants?.find((v) => v.name === item.variantName)
        : undefined;
      const v = dbVariant ?? nameVariant;
      const retail = Number(v?.retailPrice ?? dbProd.retailPrice ?? dbProd.price ?? 0);
      const wholesale = Number(v?.wholesalePrice ?? dbProd.wholesalePrice ?? retail);
      catalogListPrice = resolveListPrice({ retail, wholesale }, totalQty).price;
    }

    const image = item.image || dbProd?.images?.find((img) => img.isPrincipal)?.url || dbProd?.images?.[0]?.url || '';
    const stored = {
      productId: new Types.ObjectId(item.productId),
      variantId: dbVariant?._id,
      // Same normalization as the schema (trim + uppercase), so history matching is stable.
      sku: dbVariant?.sku ?? (item.sku ? item.sku.trim().toUpperCase() : item.sku),
      name: item.name,
      image,
      variantLabel: item.variantLabel,
      variantName: item.variantName,
      qty: item.qty,
      ...(listPrice !== undefined ? { listPrice } : {}),
      appliedPriceType: item.appliedPriceType,
      unitPrice: item.unitPrice,
      subtotal: item.unitPrice * item.qty,
    } as IOrderItem;
    return { item: stored, catalogListPrice };
  });
}

const QUANTITY_ACTIONS = new Set(['quantity_changed', 'item_added', 'item_removed']);

/**
 * PUT /api/admin/orders/:id
 * Edits items, quantities, prices, discount, payment method, guest data and
 * notes of a `pendiente` or `autorizado` order.
 * - pendiente: stock is not touched (it is taken on authorization).
 * - autorizado: stock already taken, so the per-item difference is applied
 *   (diff-and-apply): more units take stock, fewer/removed units restock.
 * Stock, order and history are written together (one transaction on a replica
 * set; reverted on standalone if the order write fails).
 * Sellers: only their own direct sale (else 404), never completada (403).
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const user = await getSession(req);
  if (!user) return sessionError(401);

  const { id } = await params;
  if (!isObjectIdString(id)) return notFoundResponse();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest('El cuerpo de la solicitud no es válido.');
  }
  const parsed = parseEditInput(raw);
  if (!parsed.ok) return badRequest(parsed.message);
  const input = parsed.value;
  const actor = { id: user.id, name: user.name };

  let deltas: ItemDelta[] = [];
  try {
    const updated = await runInTransaction(async (session) => {
      deltas = [];
      const order = await loadScopedOrder(id, user, session);
      if (isCancelledStatus(order.status)) {
        throw new OrderHttpError(409, 'INVALID_STATUS', 'La orden está cancelada y no se puede modificar.');
      }
      if (!canMutateOrder(user, order, input.status)) {
        throw new OrderHttpError(403, 'FORBIDDEN', 'No tienes permisos para realizar esta acción');
      }
      if (!EDITABLE_STATUSES.includes(order.status)) {
        throw new OrderHttpError(
          409,
          'INVALID_STATUS',
          `Solo se pueden editar órdenes en estado "pendiente" o "autorizado". Estado actual: "${order.status}".`
        );
      }

      const before = orderSnapshot(order);
      const previousItems = order.toObject().items as IOrderItem[];

      const draft = {
        items: previousItems,
        discount: input.discount ?? order.discount,
        paymentMethod: input.paymentMethod ?? order.paymentMethod,
        status: order.status,
      };
      if (input.items) {
        const built = await buildItems(input.items, previousItems, session);
        draft.items = built.map((b) => b.item);
        // listPrice follows the quantity: recomputed for every line when any
        // quantity/line changed (the total drives wholesale), else kept.
        const preview = diffOrder(before, orderSnapshot(draft), actor);
        if (preview.some((e) => QUANTITY_ACTIONS.has(e.action))) {
          draft.items = built.map(({ item, catalogListPrice }) =>
            catalogListPrice !== undefined ? { ...item, listPrice: catalogListPrice } : item
          );
        }
      }

      const subtotal = draft.items.reduce((sum, i) => sum + i.subtotal, 0);
      const set: Record<string, unknown> = {
        items: draft.items,
        subtotal,
        discount: draft.discount,
        total: Math.max(0, subtotal - draft.discount),
        paymentMethod: draft.paymentMethod,
      };
      if (input.guest) {
        const guest = { name: order.guest.name, lastName: order.guest.lastName, phone: order.guest.phone };
        if (input.guest.name) guest.name = input.guest.name.trim();
        if (input.guest.lastName) guest.lastName = input.guest.lastName.trim();
        if (input.guest.phone) guest.phone = input.guest.phone.trim();
        set.guest = guest;
      }
      if (input.notes !== undefined) set.notes = input.notes.trim();

      const history = diffOrder(before, orderSnapshot(draft), actor);
      if (input.items && holdsStock(order.status)) {
        deltas = await itemDeltas(previousItems, draft.items, session);
      }
      return applyThenWrite(deltas, session, () => writeOrderIfUnchanged(order, set, history, session));
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return mutationErrorResponse(error, deltas, 'Error al editar orden:', 'Error al actualizar la solicitud');
  }
}

// ---------------------------------------------------------------------------
// PATCH: cancel
// ---------------------------------------------------------------------------

/**
 * PATCH /api/admin/orders/:id  { action: 'cancel', notes?, cancelReason? }
 * Cancels the order. A cancelled order is final: cancelling again (or editing)
 * is 409 and never restocks twice. The stock is returned exactly once when it
 * had been taken (autorizado, completada); a pendiente order holds none.
 * Appends a `cancelled` history entry with the reason.
 * Sellers: only their own direct sale (else 404), not a completada one (403),
 * and never to completada (403).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const user = await getSession(req);
  if (!user) return sessionError(401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('El cuerpo de la solicitud no es válido.');
  }
  if (!isPlainObject(body)) return badRequest('El cuerpo de la solicitud no es válido.');

  if (body.action !== 'cancel') {
    if (!isAdminRole(user.role) && body.status === 'completada') return sessionError(403);
    return badRequest('Acción inválida. Use action: "cancel".');
  }
  const notes = optionalString(body.notes);
  const reason = optionalString(body.cancelReason);
  if (!notes.ok) return badRequest('Las notas no son válidas.');
  if (!reason.ok) return badRequest('El motivo de cancelación no es válido.');
  const cancelReason = reason.value?.trim() || undefined;

  const { id } = await params;
  if (!isObjectIdString(id)) return notFoundResponse();
  const actor = { id: user.id, name: user.name };

  let deltas: ItemDelta[] = [];
  try {
    const updated = await runInTransaction(async (session) => {
      deltas = [];
      const order = await loadScopedOrder(id, user, session);
      if (isCancelledStatus(order.status)) {
        throw new OrderHttpError(409, 'INVALID_STATUS', 'La orden ya está cancelada.');
      }
      if (!canMutateOrder(user, order, 'cancelado')) {
        throw new OrderHttpError(403, 'FORBIDDEN', 'No tienes permisos para realizar esta acción');
      }

      const before = orderSnapshot(order);
      const history = diffOrder(before, { ...before, status: 'cancelado' }, actor, cancelReason);
      const set: Record<string, unknown> = { status: 'cancelado' };
      if (notes.value) set.notes = notes.value.trim();
      if (cancelReason) set.cancelReason = cancelReason;

      if (holdsStock(order.status)) {
        deltas = await itemDeltas(order.items, [], session);
      }
      return applyThenWrite(deltas, session, () => writeOrderIfUnchanged(order, set, history, session));
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return mutationErrorResponse(error, deltas, 'Error al cancelar orden:', 'Error al cancelar la solicitud');
  }
}
