import mongoose from 'mongoose';

/**
 * Request-body primitives shared by the admin sale/order handlers. They never
 * coerce objects: an operator object such as {"$ne": null} is always rejected.
 */

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Numbers, or strings holding one (the POS historically accepted "2"); anything else is NaN. */
export function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
}

/** Only a 24-hex string is an id; objects such as {"$ne": null} never reach a query. */
export function isObjectIdString(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v) && mongoose.isValidObjectId(v);
}

/** undefined/null -> ok without value; a string -> ok with it; anything else -> not ok. */
export function optionalString(v: unknown): { ok: boolean; value?: string } {
  if (v === undefined || v === null) return { ok: true };
  return typeof v === 'string' ? { ok: true, value: v } : { ok: false };
}

/** Escapes regex metacharacters so user text is matched literally (no invalid pattern, no ReDoS). */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
