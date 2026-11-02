import { formatPrice } from '@/utils/formatCurrency';

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
 * Lines sharing a key are paired by occurrence index ("key#0", "key#1").
 */
function itemKey(i: OrderSnapshotItem): string {
  const p = i.productId ?? '';
  if (i.variantId) return `v:${i.variantId}`;
  if (i.sku) return `s:${p}:${i.sku}`;
  if (i.variantName) return `n:${p}:${i.variantName}`;
  return `p:${p}:${i.name}`;
}

function indexItems(items: OrderSnapshotItem[] | undefined): Map<string, OrderSnapshotItem> {
  const seen = new Map<string, number>();
  const out = new Map<string, OrderSnapshotItem>();
  for (const i of items ?? []) {
    const k = itemKey(i);
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    out.set(`${k}#${n}`, i);
  }
  return out;
}

function label(i: OrderSnapshotItem): string {
  return i.variantLabel ? `${i.name} (${i.variantLabel})` : i.name;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Equality where NaN equals NaN. */
function same(a: unknown, b: unknown): boolean {
  return Object.is(a, b);
}

function entry(actor: Actor, action: HistoryAction, summary: string): HistoryEntry {
  return { at: new Date(), byUserId: actor.id, byName: actor.name, action, summary };
}

export function createdEntry(actor: Actor, total: number): HistoryEntry {
  return entry(
    actor,
    'created',
    Number.isFinite(total) ? `Pedido creado (total ${formatPrice(total)})` : 'Pedido creado'
  );
}

export function diffOrder(
  before: OrderSnapshot,
  after: OrderSnapshot,
  actor: Actor,
  reason?: string
): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  const beforeMap = indexItems(before.items);
  const afterMap = indexItems(after.items);

  for (const [key, a] of afterMap) {
    const b = beforeMap.get(key);
    if (!b) {
      out.push(entry(actor, 'item_added', `Producto agregado: "${label(a)}" x${a.qty}`));
      continue;
    }
    if (!same(b.qty, a.qty)) {
      out.push(entry(actor, 'quantity_changed', `Cantidad de "${label(a)}": ${b.qty} → ${a.qty}`));
    }
    if (!same(b.unitPrice, a.unitPrice)) {
      out.push(entry(actor, 'price_changed', `Precio de "${label(a)}": ${b.unitPrice} → ${a.unitPrice}`));
    }
  }
  for (const [key, b] of beforeMap) {
    if (!afterMap.has(key)) {
      out.push(entry(actor, 'item_removed', `Producto quitado: "${label(b)}"`));
    }
  }

  const dBefore = num(before.discount);
  const dAfter = num(after.discount);
  if (dBefore !== dAfter) {
    out.push(entry(actor, 'discount_changed', `Descuento: ${dBefore} → ${dAfter}`));
  }
  if (before.paymentMethod !== after.paymentMethod) {
    out.push(
      entry(actor, 'payment_changed', `Medio de pago: ${before.paymentMethod} → ${after.paymentMethod}`)
    );
  }
  const wasCancelled = CANCELLED_STATUSES.has(before.status);
  const isCancelled = CANCELLED_STATUSES.has(after.status);
  if (before.status !== after.status && !(wasCancelled && isCancelled)) {
    if (isCancelled) {
      out.push(entry(actor, 'cancelled', `Pedido cancelado${reason ? `: ${reason}` : ''}`));
    } else {
      out.push(entry(actor, 'status_changed', `Estado: ${before.status} → ${after.status}`));
    }
  }
  return out;
}
