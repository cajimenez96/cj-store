# Seller Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin create `seller` users who register POS sales against the single shared stock, with every sale attributed, price-audited, history-tracked, and visible only to its seller (admin sees all).

**Architecture:** Role policy lives in a pure, edge-safe module (`permissions.ts`) enforced by `middleware.ts`; ownership and DB re-validation are enforced in route handlers through a `getSession` helper. Stock changes go through one guarded, atomic helper (`stock-ops.ts`) used by sale creation, edit and cancel. Orders gain `soldBy`, per-item `listPrice`, and `history[]`.

**Tech Stack:** Next.js 16 App Router, Mongoose 9 / MongoDB, `jose` JWT (`admin_token` cookie), zod, Vitest + mongodb-memory-server (new).

**Spec:** `docs/superpowers/specs/2026-11-02-seller-role-design.md`

## Global Constraints

- Roles are exactly `'superadmin' | 'admin' | 'seller'` (already in `src/models/User.ts`); `superadmin` is treated as `admin` everywhere except `DELETE /api/admin/users`.
- Sellers: default deny. Allowed pages: `/admin/orders`, `/admin/pos`, `/admin/accounting`, `/admin/stock` (read-only). Landing page after login: `/admin/orders`.
- Seller scoping comes from the token/DB user, never from query params or body.
- A seller edits/cancels only orders with `origin: 'admin_direct'` and `soldBy.userId` equal to theirs; never a `completada` order; never sets `completada`.
- Cancelled orders are final, return stock exactly once, and are excluded from accounting and deviation totals.
- Product reads for sellers return retail and wholesale prices, never cost data.
- `listPrice` ignores manual overrides (retail, or wholesale when total quantity >= `WHOLESALE_THRESHOLD` = 5), recomputed on quantity edit; order-level discount is stored apart from per-item deviation.
- Stock decrement uses a `$gte` guard; failure rejects the whole operation with nothing partially applied. Keep dual support: Mongo transaction on a replica set, compensating rollback on standalone (existing behavior in `create-direct`).
- App UI copy is Spanish (match existing screens); code, identifiers and comments are English.
- Commits: conventional commits, no AI attribution lines.

## Review Focus

- A seller requests `/api/admin/orders/<id>` of another seller or a web order → 404, no data leaked.
- A seller sends `?userId=<other>` / `?seller=<other>` to orders or accounting → ignored, still scoped to self.
- Two simultaneous sales of the last unit → exactly one succeeds, stock ends at 0, never negative.
- A cancel called twice, or an edit that fails midway → stock and order unchanged / restocked exactly once.
- A deactivated or demoted seller holding a valid JWT → 401 on the next request.

---

### Task 1: Test infrastructure and role policy

**Files:**
- Create: `vitest.config.ts`, `src/lib/permissions.ts`, `src/lib/__tests__/permissions.test.ts`
- Modify: `package.json` (devDependencies `vitest`, `mongodb-memory-server`; script `"test": "vitest run"`)

**Interfaces:**
- Produces: `type Role = 'superadmin' | 'admin' | 'seller'`; `isAdminRole(role?: string): boolean`; `canAccess(role: Role, method: string, pathname: string): boolean` (pure, no Node-only imports); `const SELLER_ACCESS_ENABLED = false` — while `false`, `canAccess` denies every seller request (today's behavior), so sellers stay locked out until Task 9 flips it. Tests for seller rules in this task must exercise the rule table with the flag overridden (export the table or accept the flag as a parameter).

- [ ] **Step 1: Install dev dependencies and configure Vitest** with the `@/` alias to `src/` and `environment: 'node'`; add the `test` script.
- [ ] **Step 2: Write failing tests** in `permissions.test.ts`: admin/superadmin → `true` for any path; seller → `true` for `GET /api/admin/orders`, `POST /api/admin/sales/create-direct`, `GET /api/admin/accounting`, `GET /api/admin/stock`, `GET /api/admin/products`, `GET|PUT|PATCH /api/admin/orders/abc123`, `GET /api/admin/auth/me`, pages `/admin/orders|pos|accounting|stock`; seller → `false` for `PUT /api/admin/stock`, `PATCH /api/admin/products/abc/stock`, `PUT /api/admin/orders`, `POST /api/admin/orders/abc/authorize`, `GET /api/admin/users`, `/admin/users`, `/admin/settings`, `POST /api/admin/products`.
- [ ] **Step 3: Run** `npx vitest run src/lib/__tests__/permissions.test.ts` → FAIL (module missing).
- [ ] **Step 4: Implement `permissions.ts`** as a rule table of `{ methods, pattern: RegExp }` for the seller; everything else denied.
- [ ] **Step 5: Run** the same command → PASS. Commit `test: add vitest and role policy module`.

### Task 2: Session helpers, middleware, auth/me, nav

**Files:**
- Modify: `src/lib/jwt.ts`, `src/middleware.ts`, `src/components/admin/AdminNav.tsx`, `src/app/admin/login/page.tsx` (no change if redirect already `/admin/orders`)
- Create: `src/lib/session.ts`, `src/lib/__tests__/session.test.ts`

**Interfaces:**
- Consumes: `canAccess`, `isAdminRole` (Task 1).
- Produces:
  - `jwt.ts`: `verifySessionToken(token: string): Promise<{ role: Role; id?: string; user: string; name?: string } | null>` (accepts all three roles; keep `verifyAdminToken` as is).
  - `session.ts`: `interface Session { id: string; username: string; name: string; role: Role }`; `getSession(req: NextRequest): Promise<Session | null>` (verifies JWT, loads the `User` by id, requires `active: true`, uses the DB role); `sessionError(status: 401 | 403 | 404): NextResponse`.

- [ ] **Step 1: Write failing tests** for `getSession`: valid token + active user → session with DB role; valid token + `active: false` → `null`; valid token whose DB role differs from the token role → DB role wins. Uses mongodb-memory-server and a signed token from `signAdminToken`.
- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/session.test.ts` → FAIL.
- [ ] **Step 3: Implement** `verifySessionToken` and `getSession`.
- [ ] **Step 4: Update `middleware.ts`** to use `verifySessionToken` and `canAccess(role, req.method, pathname)`: unauthenticated → 401 JSON / redirect (unchanged); authenticated but not allowed → 403 JSON for APIs, redirect to `/admin/orders` for pages. Middleware must not import Mongoose.
- [ ] **Step 5: Make `AdminNav.tsx` role-aware**: fetch `/api/admin/auth/me` once, filter `links` by role (seller sees Solicitudes, POS, Contabilidad, Stock), and add the missing POS entry (`/admin/pos`, label "Punto de venta").
- [ ] **Step 6: Verify manually** with a seeded seller: login → lands on `/admin/orders`; `/admin/users` redirects; `PUT /api/admin/stock` → 403. Run `npx vitest run`. Commit `feat(auth): role-aware middleware, session helper and nav`.

### Task 3: Order schema, history, listPrice, pricing helper

**Files:**
- Modify: `src/models/Order.ts`, `src/models/SalesRecord.ts`
- Create: `src/lib/order-history.ts`, `src/lib/pricing.ts`, `src/lib/__tests__/order-history.test.ts`, `src/lib/__tests__/pricing.test.ts`

**Interfaces:**
- Produces:
  - Schema: `Order.soldBy?: { userId: ObjectId; username: string; name: string }`; `Order.items[].listPrice?: number`; `Order.history: { at: Date; byUserId?: ObjectId; byName: string; action: HistoryAction; summary: string }[]`; `SalesRecord.soldBy` same shape. Index `Order.soldBy.userId`.
  - `type HistoryAction = 'created' | 'item_added' | 'item_removed' | 'quantity_changed' | 'price_changed' | 'discount_changed' | 'payment_changed' | 'status_changed' | 'cancelled'`.
  - `order-history.ts`: `interface Actor { id?: string; name: string }`; `createdEntry(actor: Actor, total: number): HistoryEntry`; `diffOrder(before: OrderSnapshot, after: OrderSnapshot, actor: Actor, reason?: string): HistoryEntry[]` (pure; one entry per relevant change, short Spanish `summary` such as `Precio de "X": 15000 → 12000`).
  - `pricing.ts`: `resolveListPrice(prices: { retail: number; wholesale?: number }, totalQty: number): { price: number; type: 'retail' | 'wholesale' }`, extracted from `create-direct` (lines ~120-142) so create and edit share it.

- [ ] **Step 1: Write failing tests**: `diffOrder` emits `price_changed` with before/after in the summary, `quantity_changed`, `item_removed`, `discount_changed`, `payment_changed`, `status_changed`, and `cancelled` (with reason); identical snapshots → `[]`. `resolveListPrice({retail:100, wholesale:80}, 4)` → `{100,'retail'}`; with qty 5 → `{80,'wholesale'}`; no wholesale price → retail.
- [ ] **Step 2: Run** both test files → FAIL.
- [ ] **Step 3: Implement** the schema additions (all optional so legacy orders stay valid), `order-history.ts`, `pricing.ts`.
- [ ] **Step 4: Run** `npx vitest run` → PASS. Commit `feat(orders): add soldBy, listPrice, history and pricing helper`.

### Task 4: Guarded atomic stock and collision-free order numbers

**Files:**
- Create: `src/lib/stock-ops.ts`, `src/models/Counter.ts`, `src/lib/__tests__/stock-ops.test.ts`

**Interfaces:**
- Produces:
  - `interface StockDelta { productId: string; variantId?: string; variantName?: string; qty: number }` (positive = remove from stock, negative = restock).
  - `class InsufficientStockError extends Error { item: StockDelta; available: number }`.
  - `applyStockDeltas(deltas: StockDelta[], session?: ClientSession | null): Promise<void>`: each decrement is a single `updateOne` with a `$gte` filter on `variants.$.stock` (legacy product-level `stock` when no variant); on any failure everything applied so far is reverted (transaction when `session` given, compensating `$inc` otherwise); recomputes `totalStock` for touched products.
  - `nextOrderNumber(session?: ClientSession | null): Promise<string>` using an atomic `findOneAndUpdate` counter; keeps the `PED-YYYY-` prefix.

- [ ] **Step 1: Write failing tests** (mongodb-memory-server, replica set and standalone variants of the same cases): decrement ok; decrement beyond stock → throws `InsufficientStockError` and **no** variant changed in a two-item batch where the second fails; negative qty restocks; 10 parallel `applyStockDeltas` of 1 unit against stock 3 → exactly 3 resolve, stock ends 0; `nextOrderNumber` called 20 times in parallel → 20 unique values.
- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/stock-ops.test.ts` → FAIL.
- [ ] **Step 3: Implement** `stock-ops.ts` and `Counter.ts` (`{ _id: string; seq: number }`).
- [ ] **Step 4: Run** → PASS. Commit `feat(stock): guarded atomic stock deltas and unique order numbers`.

### Task 5: POS sale creation with attribution

**Files:**
- Modify: `src/app/api/admin/sales/create-direct/route.ts`
- Test: `src/app/api/admin/sales/create-direct/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getSession`, `applyStockDeltas`, `nextOrderNumber`, `resolveListPrice`, `createdEntry`, `InsufficientStockError`.
- Produces: created `Order` and `SalesRecord` with `soldBy` from the session, each item with `listPrice`, `history: [created]`. Insufficient stock → HTTP 409 with `message` naming the product.

- [ ] **Step 1: Write failing tests** calling the `POST` handler directly: seller session → order has `soldBy.userId` = seller, `items[0].listPrice` = retail price while `unitPrice` = custom price, `history[0].action === 'created'`; admin session → also gets `soldBy`; selling more than stock → 409 and stock unchanged; unauthenticated → 401.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Refactor the route** to use the helpers above and remove its inline stock/rollback and order-number code; keep request/response shape unchanged.
- [ ] **Step 4: Run** `npx vitest run` → PASS. Manual check: register a POS sale as a seller in the UI and verify stock drops and the order appears. Commit `feat(pos): attribute direct sales to the seller and guard stock`.

### Task 6: Orders list, detail, edit and cancel with ownership

**Files:**
- Modify: `src/app/api/admin/orders/route.ts`, `src/app/api/admin/orders/[id]/route.ts`, `src/app/api/admin/orders/[id]/authorize/route.ts`
- Create: `src/lib/order-access.ts`
- Test: `src/app/api/admin/orders/__tests__/orders.test.ts`

**Interfaces:**
- Consumes: Tasks 2-5.
- Produces: `order-access.ts`: `ordersScope(session: Session, userFilter?: string): FilterQuery<IOrder>` (seller → `{ 'soldBy.userId': session.id }` always; admin → all, or `{ origin: 'web' }` for `userFilter === 'web'`, or by `soldBy.userId`); `canMutateOrder(session: Session, order: IOrder, nextStatus?: string): boolean` implementing the Global Constraints rules.

- [ ] **Step 1: Write failing tests** (handlers called directly): seller list returns only own orders even with `?userId=<other>`; admin list with `?userId=<seller>` returns that seller's; `userId=web` returns web orders; seller GET of another seller's or web order → 404; seller PATCH to `completada` → 403; seller edit of own `autorizado` order changing qty 2→1 restocks 1 unit, appends `quantity_changed`; price change appends `price_changed` and updates `unitPrice` while `listPrice` is recomputed on qty edits; seller cancel restocks, appends `cancelled`, a second cancel → 409 with no extra restock; seller edit/cancel of a `completada` order → 403; edit that exceeds stock → 409 and order unchanged; seller `POST .../authorize` → 403 (also denied by policy).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement `order-access.ts`**, then rewrite the edit/cancel paths in `orders/[id]` as diff-and-apply: compute `StockDelta[]` from the item changes, call `applyStockDeltas` and save the order in one transaction/compensation scope, append `diffOrder` entries. Replace the non-atomic `product.save()` stock logic in the list route's PUT with the same helper (admin only).
- [ ] **Step 4: Run** `npx vitest run` → PASS. Commit `feat(orders): ownership scoping, atomic edit/cancel and history`.

### Task 7: Accounting scoped by seller with deviation and per-seller breakdown

**Files:**
- Modify: `src/app/api/admin/accounting/route.ts`
- Test: `src/app/api/admin/accounting/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getSession`, `ordersScope`.
- Produces: response keeps today's fields and adds `deviation: { above: number; below: number }` and, for admin only, `bySeller: { userId: string | 'web'; name: string; totalSold: number; salesCount: number; units: number; above: number; below: number }[]`. Seller response omits `expenses`, net income and `bySeller`; admin accepts `?userId=` filter.

- [ ] **Step 1: Write failing tests**: seller sees only own totals; seller response has no `expenses`/net; cancelled orders excluded; `deviation.above` = Σ max(0, (unitPrice − listPrice)·qty), `below` the opposite, ignoring items without `listPrice`; admin `bySeller` groups web orders under `'web'`; `?userId=` on a seller request is ignored.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** by adding the scope to the existing query and computing deviation and breakdown in the existing JS loop.
- [ ] **Step 4: Run** → PASS. Commit `feat(accounting): seller-scoped monthly view and per-seller breakdown`.

### Task 8: Read-only stock and restricted product reads

**Files:**
- Modify: `src/app/api/admin/stock/route.ts`, `src/app/api/admin/products/route.ts`, `src/app/admin/stock/page.tsx`
- Test: `src/app/api/admin/stock/__tests__/stock.test.ts`

**Interfaces:**
- Consumes: `getSession`.
- Produces: `GET /api/admin/products` for a seller returns the same list minus cost fields (builder lists them from `src/models/Product.ts`); stock page hides edit controls when `role === 'seller'` (role from `auth/me`).

- [ ] **Step 1: Write failing tests**: seller `GET /api/admin/stock` → 200; seller `PUT /api/admin/stock` → 403; seller `GET /api/admin/products` response items contain no cost fields but do contain wholesale prices; admin response unchanged.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** server-side stripping in the products GET and the UI hiding in the stock page.
- [ ] **Step 4: Run** → PASS. Commit `feat(stock): read-only stock view and restricted product reads for sellers`.

### Task 9: UI — user filter, history field, seller views, docs

**Files:**
- Modify: `src/app/admin/orders/page.tsx`, `src/components/admin/OrderDetailModal.tsx`, `src/components/admin/OrderEditModal.tsx`, `src/app/admin/accounting/page.tsx`, `docs/arquitectura.md`, `docs/producto.md`

**Interfaces:**
- Consumes: Tasks 2-8 APIs (`?userId=`, `history`, `soldBy`, `deviation`, `bySeller`).

- [ ] **Step 1: Orders page**: admin gets a "Vendedor" select (Todos, Web, each user from `/api/admin/users`); the list shows the seller name per row; seller view hides the select and the web/authorize actions.
- [ ] **Step 2: Detail modal**: add the "Historial" section (date, who, summary, newest first) and per-item price deviation (listed vs charged, with a more/less marker).
- [ ] **Step 3: Accounting page**: seller sees only own income, units and deviation; admin sees the user filter and the per-seller table.
- [ ] **Step 4: Docs**: replace "seller has no panel access" in `docs/arquitectura.md` (≈ lines 29, 236, 258-261, 316) and `docs/producto.md` (≈ lines 94-95, 199) with the role matrix from Global Constraints.
- [ ] **Step 5: Flip `SELLER_ACCESS_ENABLED` to `true`** in `permissions.ts` (last change of the project; earlier tasks keep sellers locked out so unscoped routes are never exposed), and add a test asserting a seller request is allowed on `GET /api/admin/orders` with the flag on.
- [ ] **Step 6: Verify** with `npm run lint`, `npx vitest run`, `npm run build`, then a manual run through the browser as admin and as seller (create sale with custom price, edit it, cancel it, check history and accounting). Commit `feat(admin): user filter, order history and seller views`.

---

## Self-review notes

- Spec coverage: roles/allowlist/nav/DB re-validation (T1-2), attribution + price audit + history (T3, T5), edit/cancel rules (T6), accounting (T7), read-only stock + restricted products (T8), stock safety + order numbers (T4), UI and docs (T9). Rollout and dual Mongo mode are in Global Constraints.
- Deliberate order: stock safety (T4-5) and scoping (T6-8) land first; sellers stay blocked by `SELLER_ACCESS_ENABLED = false` until Task 9 enables them, so no unscoped route is ever reachable by a seller.
