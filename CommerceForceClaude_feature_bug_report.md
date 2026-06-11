# CommerceForce — Features & Bugs (code-level review)

Reviewed: `backend/` (FastAPI, plugin-based), `frontend-admin/` (Next.js admin), `frontend-starter/` (Next.js storefront).
Backend test suite: **112 tests, all passing**. The bugs below are mostly logic/integration gaps the tests don't cover.

---

## Architecture (built)
- **Plugin system**: each feature is a self-contained plugin under `backend/app/plugins/<name>/` with `manifest.py`, `models.py`, `schemas.py`, `service.py`, `router.py`. Plugins are enabled via `ENABLED_PLUGINS` env var and auto-mounted at `/api/<plugin>` (`app/core/plugin_registry.py`).
- **Dynamic admin nav**: `GET /api/menu` builds admin/superadmin menus from active plugin manifests.
- **Auth/security**: JWT access tokens + httpOnly refresh-cookie with rotation; bcrypt password hashing; role-based guards (`customer`/`admin`/`superadmin`).
- **DB**: async SQLAlchemy 2.0 + Alembic; UUID PKs and created/updated timestamps via base model. Default SQLite, Postgres in `docker-compose.yml`.
- **Shared utils**: pagination, slug/SKU generation, email, exceptions.

## Backend features (by plugin)
| Plugin | What it does |
|---|---|
| **auth** | Register, login, refresh, logout, `/me` get/update; refresh-token rotation & revocation; roles |
| **products** | CRUD, slug/SKU auto-gen, images (primary/ordering), search + filters (category/in-stock/featured), sorting, pagination, **CSV import**, sale pricing (`effective_price`), stock |
| **categories** | CRUD, nested/root categories |
| **cart** | Guest (cookie session) + user carts, add/update/remove/clear, **merge guest→user on login** |
| **checkout** | Cart or explicit-items checkout, guest checkout, payment methods (cash / credit / stripe-stub), applies coupons + loyalty redemption, deducts stock, earns loyalty points |
| **orders** | List (scoped by role), get, admin status update, customer cancel, order numbers |
| **coupons** | CRUD, percentage/fixed discounts, min-order/expiry/max-uses, validation + usage tracking |
| **credit** | B2B credit accounts (limit/used/available), admin CRUD, check-and-deduct at checkout |
| **inventory** | Warehouses + per-warehouse stock (set/adjust), stock summaries |
| **loyalty** | Config, accounts, earn/redeem points, manual adjust, transaction history |
| **newsletter** | Subscribe/unsubscribe (token), admin subscriber list, stats |
| **landing_page** | CMS-style page sections: CRUD, reorder, active filter |
| **branding** | Store branding config (name/tagline/etc.) get/update |
| **rfq** | B2B Request-for-Quote: draft→submit→review→quote→accept/reject; accept converts to an order |
| **ai_chat** | Anthropic-backed shopping assistant, branding-aware system prompt |

## Frontend features
- **Admin** (`frontend-admin/`): dashboard + pages for products (list/new/edit), orders (list/detail), categories, coupons, credit, inventory, loyalty, newsletter, landing-page, branding, RFQ; login; auth store with token refresh.
- **Storefront** (`frontend-starter/`): home + landing sections, product list w/ filter bar, product detail + add-to-cart, cart, checkout + success, account (profile/settings/orders), login/register, AI chat widget.

---

## Bugs & issues (highest impact first)

### 1. CRITICAL — Storefront checkout hits a non-existent endpoint (404)
`frontend-starter/app/checkout/page.tsx:64` posts to `/api/checkout/place`, but the backend only defines `POST /api/checkout` (`backend/app/plugins/checkout/router.py:17`). There is no `/place` route anywhere. **Placing an order from the shop always 404s** — checkout is broken end-to-end from the UI.
Fix: change the frontend call to `POST /api/checkout` (or add a `/place` alias).

### 2. HIGH — Storefront cart "update quantity" and "remove" are broken
The cart page passes the **cart-item id** to update/remove (`frontend-starter/app/cart/page.tsx:45,51,55` → `updateItem(item.id, ...)` / `removeItem(item.id)`), which call `/api/cart/items/{id}` (`frontend-starter/store/cart.ts:288,293`). But the backend keys those endpoints by **product_id** (`PUT/DELETE /api/cart/items/{product_id}`, and the service matches `CartItem.product_id`). Since `item.id != product_id`, the API returns 404 "Item not in cart" → users can't change quantities or remove items.
Fix: pass `item.product_id` from the cart page (the `CartItemOut` already exposes both `id` and `product_id`).

### 3. HIGH — Cancelling an order doesn't restore stock, credit, or loyalty points
`orders/service.py cancel_order` only flips status to `cancelled`; it never re-adds stock, never refunds consumed credit, never reverses earned/redeemed points. Notably `credit/service.py restore_credit()` exists but is **never called anywhere** in the codebase (dead code). Net effect: cancelled orders permanently leak inventory and keep the customer's credit consumed.

### 4. HIGH — RFQ acceptance bypasses stock deduction and credit checks
`rfq/service.py accept_rfq` creates a `credit_limit` order but (unlike `checkout/service.py`) does **not** deduct product stock, does **not** validate/deduct the customer's credit limit, and never sets `payment_status`. This allows overselling and uncharged credit orders via the RFQ path.

### 5. MEDIUM — Inventory plugin is a disconnected, second source of truth for stock
Cart, checkout, and product listings all read/write `Product.stock_quantity`. The `inventory` plugin's per-warehouse `WarehouseStock` is never consulted during fulfillment and is never synced with `Product.stock_quantity`. The two stock systems can silently diverge.

### 6. MEDIUM — Plugin `depends_on` is declared but never enforced
Manifests declare dependencies (e.g. `cart → products`, `checkout → cart, orders`), but `plugin_registry._validate_manifest` only checks for required keys and ignores `depends_on`. Enabling `checkout` without `cart`/`orders` won't be caught at startup — it fails later at runtime/import with a less obvious error.

### 7. LOW/MEDIUM — Cart quantity update skips stock validation
`cart/service.py update_item` sets the new quantity with no stock check, and `add_item` only checks the *incremental* quantity, not the resulting total. So a cart can hold more than is in stock (it's only caught later at checkout).

### 8. LOW — Coupon `/validate` swallows all errors as "invalid"
`coupons/router.py validate_coupon` wraps the call in `except Exception` and returns `valid: false` with the raw message. Any unexpected internal error is surfaced to the customer as an invalid-coupon message.

---

## Notes
- Seeded admin (via `backend/seed.py`): `admin@commerceforce.dev` / `Admin1234!` (role `admin`; no `superadmin` is seeded).
- Default `ENABLED_PLUGINS` in `config.py` is just `auth`; `.env.example` enables `auth,categories,products,cart,orders,checkout`. The full feature set requires enabling the rest.
- `stripe` payment method is a stub (listed as available, but no real payment intent flow is implemented).
