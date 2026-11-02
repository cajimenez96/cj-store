# Seller Role — Design

Date: 2026-11-02
Status: draft, pending approval

## Intent

Today the store has a single operator (the admin) who creates products and registers direct sales ("ventas directas") through the POS. Several people now sell separately and the admin loses track of stock and of who sold what.

The goal is to let the admin create `seller` users who can register POS sales against the **single shared stock**, so that every sale is attributed, auditable, and stock stays under control.

Primary value: **stock control**. Attribution and reporting follow from it.

## Goals

- Sellers log in and use the POS to register direct sales; each sale decrements the shared stock and is attributed to the seller.
- A seller sees only their own sales (list, detail, monthly accounting).
- A seller can view stock in read-only mode.
- A seller can view, edit and cancel their own sales. Every change is recorded.
- A seller may change the price of any item and apply any discount. The deviation from list price is recorded per item so the admin can see whether the seller charged more or less.
- The admin sees all sales (web and POS) with a filter by user, and can open any order to see its change history.
- Concurrent sales by several sellers cannot oversell stock.

## Non-goals

- Per-seller stock assignment or consignment (stock stays single and shared).
- Commissions, targets, or payroll.
- Seller access to products, categories, attributes, brands, promotions, reports, settings, users, expenses, or any stock editing.
- A full field-by-field diff of every edit.
- Any change to the public storefront or to how web orders are created.

## Anti-goals

- A seller must never see or modify another seller's sales, web orders, or admin sales.
- A seller must never see cost data or wholesale configuration beyond what the POS needs to sell.
- Authorization must not rely on hiding UI only; every API route enforces roles server-side.

## Decisions made with the owner

1. Two effective roles: `admin` (the current user) and `seller`. Sales made from the website stay attributed to the admin side, not to any seller.
2. Each POS sale records who registered it.
3. Seller lands on and can use: **Solicitudes** (their sales + the POS) and **Contabilidad** (their own monthly history: what they sold, quantities, etc.). Stock is visible read-only.
4. Seller has full freedom over item price and discount in the POS.
5. Price deviation must be recorded: whether the seller charged more or less than list price.
6. Seller can view, edit, and cancel their own sales; everything is recorded.
7. Admin opens any order and sees a **Historial** field listing relevant changes: simple, identifying relevant events. Not a full diff.
8. Admin sees a full history of sales/requests with a filter by user.

## Findings in the current code (verified by exploration)

- Stack: Next.js 16 App Router, Mongoose on MongoDB, JWT via `jose` in an httpOnly `admin_token` cookie. No automated tests exist.
- `User.role` already includes `'superadmin' | 'admin' | 'seller'` (`src/models/User.ts`) and the Users admin page already creates sellers. The role is currently blocked everywhere: `verifyAdminToken` (`src/lib/jwt.ts`) and `src/middleware.ts` accept only admin/superadmin.
- `src/middleware.ts` is the only guard for ~18 admin API routes; only `/api/admin/users` checks roles in-route.
- `POST /api/admin/sales/create-direct` creates the `Order` (`origin: 'admin_direct'`, `status: 'autorizado'`) and a `SalesRecord`, and decrements `variants.$.stock` with `$inc`. It does not read the token and stores no creator. The decrement has no `$gte` guard. Order numbers (`PED-YYYY-<count+1><random>`) can collide.
- Order items store only the final `unitPrice` and `appliedPriceType` (`retail|wholesale|custom`); there is no list-price field.
- `GET /api/admin/accounting` aggregates in JS by month for statuses autorizado/completada/confirmada; no per-origin or per-user breakdown.
- Stock page: `GET /api/admin/stock` (read) and `PUT /api/admin/stock` + `PATCH /api/admin/products/[id]/stock` (write).
- The nav (`src/components/admin/AdminNav.tsx`) is a static list with no role awareness, and `/admin/pos` is not in it.
- The JWT carries the role for 7 days and is never revalidated against the database.
- `docs/arquitectura.md` and `docs/producto.md` state that sellers have no panel access and must be updated.

## Design

### 1. Authorization

- Replace the boolean admin check with a role-aware check that exposes the token payload (role, id, username, name).
- `src/middleware.ts` enforces an allowlist of (path pattern, HTTP method) → roles. Anything not listed for `seller` is denied (default deny for sellers). Admin/superadmin keep today's access.
- Seller allowlist (starting point, builder to confirm against actual routes):
  - `GET/POST` orders/sales routes needed for their own sales, the POS creation route, and edit/cancel of their own orders.
  - `GET` accounting, scoped to the seller.
  - `GET` stock (read-only) and a restricted product read for POS search.
  - `GET /api/admin/auth/me`, login, logout.
- Ownership is enforced **in the route handlers**, not only in middleware: a seller requesting an order they did not create gets 404/403. Filters for sellers are forced server-side from the token and never taken from query params.
- Seller landing page after login: `/admin/orders`.
- Role re-validation: for sellers, check `active` and role against the database on each protected request (or on a short interval), so deactivating a seller takes effect immediately. *(My call: prevents a deactivated seller from keeping access for 7 days.)*
- Nav is role-filtered (seller sees Solicitudes, Contabilidad, Stock, and a POS entry). Role comes from `auth/me`.
- Product reads for the POS return retail and wholesale prices (the POS needs them) but must not return cost data to a seller. *(My call; builder decides the exact field list from the Product model.)*
- Rollout: sellers already created in the Users page become active as soon as this ships. *(My call; accepted.)* Role/active re-validation against the database happens in route handlers, since Next.js middleware cannot use Mongoose on the edge runtime (builder chooses the mechanism).
- Transactions: the existing code supports both replica set and standalone MongoDB; the builder keeps that dual support for edits and cancellations.

### 2. Attribution

- Add `soldBy { userId, username, name }` to `Order` and `SalesRecord`, set from the token in `create-direct`.
- Web orders have no `soldBy` and are treated as admin/web sales.
- POS sales registered by the admin also get `soldBy`. The user filter distinguishes "Web" from each user, admin included. *(My call.)*
- Existing orders without `soldBy` are treated as admin sales; no data migration is required. *(My call.)*
- Admin Solicitudes list gets a filter by user (all, web, admin, each seller). Admin sees everything by default.

### 3. Price audit

- Add to each order item the list price at time of sale (`listPrice`) alongside the existing `unitPrice`. Deviation per item = `unitPrice - listPrice`. List price is the retail or wholesale price the system would have applied by its normal rules.
- Aggregated per sale and per seller: total charged above list, total below list. Shown in the admin order detail and in accounting.
- `listPrice` ignores any manual override: it is what the normal rules resolve for that quantity (retail, or wholesale when the quantity reaches the wholesale threshold). It is recomputed when the quantity is edited. *(My call.)*
- The order-level discount is recorded separately and is not part of the per-item deviation. *(My call.)*
- Old orders have no `listPrice`; they show no deviation. *(My call.)*

### 4. History (audit trail)

- Add `history[]` to `Order`: `{ at, byUserId, byName, action, summary }`.
- Recorded actions: created, item added/removed, quantity changed, price changed, discount changed, payment method changed, status changed, cancelled (with reason).
- `summary` is a short human-readable line (for example "Item X: price 15000 → 12000"). No full diffs.
- Admin sees the full history of any order. A seller sees the history of their own orders. *(My call.)*
- Written by the same code path that performs the change so it cannot be skipped.

### 5. Seller edits and cancellations

- A seller can edit and cancel only orders where `soldBy.userId` is theirs and `origin` is `admin_direct`.
- **Confirmed by the owner:**
  - A seller can change items, quantities, prices, discount and payment method of their own sale. Each change adjusts stock atomically.
  - A seller can cancel their own sale; cancelling always returns the stock.
  - A seller cannot set a sale to `completada`.
  - A seller cannot edit or cancel a sale that is already `completada`; only the admin can.
  - A cancelled sale cannot be reopened and does not count in accounting (seller or admin totals, nor price deviation).
- Edits and cancellations adjust stock. Stock adjustment becomes atomic and guarded (see 7); the current non-atomic `product.save()` path in order PUT is a known weakness to fix as part of this work. Edits compute stock deltas per item (diff-and-apply).
- No time limit on editing a sale in `autorizado` state. *(My call; none was requested.)*

### 6. Accounting

- Admin: today's view plus a user filter and a per-seller breakdown (total sold, number of sales, units, deviation from list price).
- Seller: only their own monthly history: sales, units, totals, and price deviation. *(My call: sellers do not see expenses, net income, or other people's data.)*
- Scoping is applied server-side from the token.

### 7. Stock safety

- Stock decrement uses a conditional update (`$gte` guard on the variant stock); if the guard fails, the sale is rejected with a clear message and nothing is partially applied.
- Order numbers are generated without collision risk (builder chooses the mechanism, for example an atomic counter).
- `totalStock` and derived fields are kept consistent after POS sales, edits, and cancellations.
- Stock page: write controls are hidden for sellers, and the write endpoints (`PUT /api/admin/stock`, `PATCH /api/admin/products/[id]/stock`) deny the seller role server-side.

### 8. Docs and tests

- Update `docs/arquitectura.md` and `docs/producto.md` where they say sellers have no panel access, and document the role matrix.
- The repo has no tests. The builder should introduce a minimal runner and cover at least: the role/route allowlist, order ownership scoping, the atomic stock guard, and history recording.

## Left to the builder

- Exact middleware structure and allowlist format.
- Exact field names and schema details beyond those named above.
- Mechanism for collision-free order numbers and for re-validating the user against the database.
- UI layout for the history field, the user filter, and the seller's accounting view.
- Whether the POS gets its own nav entry or stays reachable from Solicitudes (it is currently not in the nav).

## Suggested delivery order

1. Authorization (role-aware token check, middleware allowlist, route ownership, nav filtering).
2. Attribution, list-price capture, and history.
3. Seller views: Solicitudes, Contabilidad, read-only Stock, admin user filter and per-seller breakdown.
4. Stock safety: guarded atomic decrement, order number generation, consistency of `totalStock`.

Stock safety (step 4) is the owner's primary motivation; the builder may reorder so it lands before sellers are enabled in production.
