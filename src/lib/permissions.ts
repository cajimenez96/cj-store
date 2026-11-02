// Pure, edge-safe role policy (imported by middleware): no Node-only or Mongoose imports.

export type Role = 'superadmin' | 'admin' | 'seller';

/** While false, sellers are denied everywhere (they stay locked out). Flipped in the final task. */
export const SELLER_ACCESS_ENABLED = false;

export function isAdminRole(role?: string): boolean {
  return role === 'admin' || role === 'superadmin';
}

interface Rule {
  methods: readonly string[];
  pattern: RegExp;
}

const READ = ['GET'] as const;
const ORDER_WRITE = ['GET', 'PUT', 'PATCH'] as const;

/** Everything not matched here is denied for sellers. */
export const SELLER_RULES: readonly Rule[] = [
  // API
  { methods: READ, pattern: /^\/api\/admin\/orders\/?$/ },
  { methods: ORDER_WRITE, pattern: /^\/api\/admin\/orders\/[^/]+\/?$/ },
  { methods: ['POST'], pattern: /^\/api\/admin\/sales\/create-direct\/?$/ },
  { methods: READ, pattern: /^\/api\/admin\/accounting\/?$/ },
  { methods: READ, pattern: /^\/api\/admin\/stock\/?$/ },
  { methods: READ, pattern: /^\/api\/admin\/products\/?$/ },
  { methods: READ, pattern: /^\/api\/admin\/auth\/me\/?$/ },
  // Pages
  { methods: READ, pattern: /^\/admin\/(orders|pos|accounting|stock)(\/.*)?$/ },
];

export function canAccess(
  role: Role,
  method: string,
  pathname: string,
  { sellerAccessEnabled = SELLER_ACCESS_ENABLED }: { sellerAccessEnabled?: boolean } = {},
): boolean {
  if (isAdminRole(role)) return true;
  if (role !== 'seller' || !sellerAccessEnabled) return false;
  const m = method.toUpperCase();
  return SELLER_RULES.some((r) => r.methods.includes(m) && r.pattern.test(pathname));
}
