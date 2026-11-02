export type HistoryAction =
  | 'created'
  | 'item_added'
  | 'item_removed'
  | 'quantity_changed'
  | 'price_changed'
  | 'discount_changed'
  | 'payment_changed'
  | 'status_changed'
  | 'cancelled';

export interface Actor {
  id?: string;
  name: string;
}

export interface HistoryEntry {
  at: Date;
  byUserId?: string;
  byName: string;
  action: HistoryAction;
  summary: string;
}

export interface OrderSnapshotItem {
  variantId?: string;
  productId?: string;
  sku?: string;
  variantName?: string;
  name: string;
  variantLabel?: string;
  qty: number;
  unitPrice: number;
}

export interface OrderSnapshot {
  items: OrderSnapshotItem[];
  discount: number;
  paymentMethod: string;
  status: string;
}

const CANCELLED_STATUSES = new Set(['cancelled', 'cancelado', 'cancelada']);

/**
 * Item matching key: variantId when present; otherwise sku, otherwise
 * variantName, always scoped by productId (and name as last resort).
 */
function itemKey(i: OrderSnapshotItem): string {
  const p = i.productId ?? '';
  if (i.variantId) return `v:${i.variantId}`;
  if (i.sku) return `s:${p}:${i.sku}`;
  if (i.variantName) return `n:${p}:${i.variantName}`;
  return `p:${p}:${i.name}`;
}

function label(i: OrderSnapshotItem): string {
  return i.variantLabel ? `${i.name} (${i.variantLabel})` : i.name;
}

function entry(actor: Actor, action: HistoryAction, summary: string): HistoryEntry {
  return { at: new Date(), byUserId: actor.id, byName: actor.name, action, summary };
}

export function createdEntry(actor: Actor, total: number): HistoryEntry {
  return entry(actor, 'created', `Pedido creado por ${total}`);
}

export function diffOrder(
  before: OrderSnapshot,
  after: OrderSnapshot,
  actor: Actor,
  reason?: string
): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  const beforeMap = new Map(before.items.map((i) => [itemKey(i), i]));
  const afterMap = new Map(after.items.map((i) => [itemKey(i), i]));

  for (const [key, a] of afterMap) {
    const b = beforeMap.get(key);
    if (!b) {
      out.push(entry(actor, 'item_added', `Producto agregado: "${label(a)}" x${a.qty}`));
      continue;
    }
    if (b.qty !== a.qty) {
      out.push(entry(actor, 'quantity_changed', `Cantidad de "${label(a)}": ${b.qty} → ${a.qty}`));
    }
    if (b.unitPrice !== a.unitPrice) {
      out.push(entry(actor, 'price_changed', `Precio de "${label(a)}": ${b.unitPrice} → ${a.unitPrice}`));
    }
  }
  for (const [key, b] of beforeMap) {
    if (!afterMap.has(key)) {
      out.push(entry(actor, 'item_removed', `Producto quitado: "${label(b)}"`));
    }
  }

  if (before.discount !== after.discount) {
    out.push(entry(actor, 'discount_changed', `Descuento: ${before.discount} → ${after.discount}`));
  }
  if (before.paymentMethod !== after.paymentMethod) {
    out.push(
      entry(actor, 'payment_changed', `Medio de pago: ${before.paymentMethod} → ${after.paymentMethod}`)
    );
  }
  if (before.status !== after.status) {
    if (CANCELLED_STATUSES.has(after.status)) {
      out.push(entry(actor, 'cancelled', `Pedido cancelado${reason ? `: ${reason}` : ''}`));
    } else {
      out.push(entry(actor, 'status_changed', `Estado: ${before.status} → ${after.status}`));
    }
  }
  return out;
}
