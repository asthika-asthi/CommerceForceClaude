# CommerceForce — Bugs Log

Created: 2026-07-04. Findings from a full-codebase bug review (backend + storefront + admin).

Status of each: **Open** unless marked otherwise. No code fixes were made for these except
where noted. Severity reflects impact × likelihood.

Coverage note: the review focused first on the high-risk paths (auth, cart, checkout,
orders, inventory, coupons, loyalty, credit, products, branding) and swept the remaining
plugins/frontends for the same bug classes. Lower-risk CRUD (individual admin pages, minor
plugins) was sampled, not read line-by-line.

---

## HIGH

### B1 — Stripe payments mutate state before the card is charged — **FIXED**
- **Where:** `backend/app/plugins/checkout/service.py`.
- **What was wrong:** For Stripe, `checkout()` only creates a PaymentIntent, but stock/coupon/loyalty mutations ran unconditionally *before* payment; the webhook only flipped status and there was no reversal path. An abandoned/declined card checkout permanently oversold stock, consumed a coupon use, spent redeemed points, and earned points for an unpaid order.
- **Fix (applied):** The integrity-critical effects (deduct stock, record coupon usage, redeem + earn loyalty) are extracted into `_apply_paid_order_effects` and applied **only when the order is paid**: synchronously for cash/credit, and from `handle_stripe_webhook` on `payment_intent.succeeded` for card. The coupon code + points-to-redeem are stashed in the PaymentIntent `metadata` for the webhook to replay (no schema change). The webhook application is guarded by the existing `payment_status != paid` check, so duplicate deliveries don't double-apply. Covered by `tests/test_checkout_deferral.py` (Stripe defers then applies on webhook; webhook idempotent; cash still applies synchronously). Full suite 220 passing.
- **Note:** F10 (frontend creates the order before card confirmation) is now benign — the order stays `pending` with no side effects until the webhook, so an abandoned card payment leaks nothing.

### B4 — A regular admin can self-escalate to superadmin (security) — **FIXED**
- **Where:** `backend/app/plugins/auth/router.py` (`patch_user`), `auth/service.py`.
- **What was wrong:** `patch_user` is guarded by `require_admin()` (allows admin **or** superadmin), and the service applied `UserRole(data["role"])` with no restriction — so any admin could `PATCH /api/auth/users/{id}` with `{"role":"superadmin"}` on any account (including their own) and gain full superadmin rights.
- **Fix (applied):** `patch_user` now takes `actor_is_superadmin`; if the request tries to change `role` and the caller is not a superadmin, it returns **403**. Admins can still toggle `is_active`/`trade_status`. Covered by `tests/test_security_fixes.py` (admin→superadmin blocked, admin→any-role blocked, admin deactivate still works, superadmin can change role).

### F8 — Add-to-cart from product listings is broken (passes product id as variant id) — **FIXED**
- **Where:** `frontend-starter/components/shop/product-card.tsx`, `components/blocks/commerce/featured-products-grid.tsx`, `app/account/wishlist/page.tsx`. Backend: `cart/service.py`.
- **What was wrong:** These called `addItem(product.id)`, but the cart store and backend expect a **variant id**. `add_item` looked up `ProductVariant.id == variant_id` and returned 404 for a product id, so nothing was added. product-card and featured-grid ignored the `false` return and still flashed "Added!".
- **Fix (applied):** The backend cart now accepts a `product_id` and resolves the product's **default variant** server-side (`AddItemRequest` takes `variant_id` *or* `product_id`; `add_item` calls `get_or_create_default_variant`). A new `addProduct(product_id)` cart-store method posts `product_id`; the three listing components use it and now honor the boolean — showing a red "try again" state on failure instead of a false "Added!". The product detail page still uses `addItem(variantId)` for option-specific adds. Verified live (product_id add resolves the default variant) and with the full backend suite (200 passing).

---

## MEDIUM

### B5 — Password reset/change does not revoke existing sessions (security) — **FIXED**
- **Where:** `backend/app/plugins/auth/service.py` (`reset_password`, `change_password`).
- **What was wrong:** Both updated the password hash but never revoked the user's `RefreshToken` rows, so an attacker's refresh token stayed valid until natural expiry even after the victim changed their password.
- **Fix (applied):** New `revoke_all_refresh_tokens(user_id, db)` marks every one of the user's refresh tokens revoked; `change_password` and `reset_password` now call it. Covered by `tests/test_security_fixes.py` (refresh works before, then returns 401 after a change and after a reset).

### B2 — Explicit-items checkout ignores variant pricing
- **Where:** `backend/app/plugins/checkout/service.py:84` (`_items_from_explicit`).
- **What's wrong:** Prices at `product.effective_price` and sets no `variant_id`, whereas the cart path (line 76) adds `variant.price_adjustment`.
- **Failure scenario:** A variant product checked out via the explicit `data.items` path is charged the base price (undercharge) and the order line has no variant recorded.
- **Fix direction:** Resolve the variant + price adjustment in the explicit path, or remove the path if it is unused.

### F9 — Checkout order summary ignores discounts — **FIXED**
- **Where:** `frontend-starter/app/checkout/page.tsx`.
- **What was wrong:** Displayed `Total = subtotal + shipping`, omitting the coupon and loyalty discounts the backend actually applies, so the shown total didn't match the charge.
- **Fix (applied):** Added an "Apply" action on the coupon field that calls `GET /api/coupons/validate` and shows the returned discount; fetches `GET /api/loyalty/config` to compute the loyalty-points discount from `redemption_rate`. The summary now shows a "Coupon discount" and "Loyalty points" line and computes `Total = subtotal − min(discounts, subtotal) + shipping`, mirroring the backend. Also fixed a pre-existing bug where the Shipping line rendered a literal `&#163;` (entity inside a template literal).

### F10 — Order created before card confirmation (frontend half of B1)
- **Where:** `frontend-starter/app/checkout/page.tsx:165` (POST `/api/checkout`) then `:178` (`stripe.confirmCardPayment`).
- **What's wrong:** The order (and all B1 side effects) is created on the server before the card is confirmed on the client. On card failure/abandonment the frontend only shows an error; the backend order persists.
- **Fix direction:** Tied to B1 — defer side effects until payment success, or cancel the pending order when confirmation fails.

### B9 — `update_status` has no state-machine validation — **FIXED**
- **Where:** `backend/app/plugins/orders/service.py`.
- **What was wrong:** `update_status` set `order.status` to any target; an admin could move a **cancelled** order (stock already restored) to `shipped`/`confirmed`, desyncing inventory.
- **Fix (applied):** Added an `_ALLOWED_TRANSITIONS` table (cancelled and delivered are terminal; no backward moves) and `update_status` now returns **409** for an illegal transition. Legitimate forward moves (e.g. pending→confirmed) still work. Covered by `tests/test_order_lifecycle.py`.

---

## LOW / INFO

### B3 — Two divergent stock sources of truth
- **Where:** `checkout/service.py` + `products/service.py` (`deduct_stock`, product-level) vs `inventory/service.py` (`WarehouseStock`, per-variant).
- **What's wrong:** Checkout validates/deducts `product.stock_quantity`; the inventory plugin tracks per-variant warehouse stock separately. Nothing reconciles them, so they can drift.
- **Fix direction:** Decide which is authoritative and make the other derive from it (or sync on deduct/restore).

### B6 — Coupon "one per customer" not enforced
- **Where:** `backend/app/plugins/coupons/service.py:67` (`validate_coupon`).
- **What's wrong:** Only the global `used_count >= max_uses` is checked. `CouponUsage.user_id` is written but never read.
- **Fix direction:** If per-customer limits are intended, count this user's prior `CouponUsage` rows in `validate_coupon` and reject.

### B7 — Login doesn't require email verification
- **Where:** `backend/app/plugins/auth/service.py:131` (`authenticate`).
- **What's wrong:** Checks `is_active` but not `is_email_verified`, so verification is effectively optional. Likely intentional — confirm.

### B8 — Cancelling an order never reverses coupon usage — **FIXED**
- **Where:** `backend/app/plugins/orders/service.py` (both cancel paths), `coupons/service.py`.
- **What was wrong:** Cancellation restored stock, credit, and loyalty but never decremented `coupon.used_count` or removed the `CouponUsage` row, so a cancelled order permanently burned a coupon use.
- **Fix (applied):** New `coupon_service.reverse_usage(order_id, db)` decrements each coupon's `used_count` and deletes the `CouponUsage` rows; both `cancel_order` (customer) and `update_status`→cancelled (admin) now call it. Covered by `tests/test_order_lifecycle.py`.

### F11 — Minor silent catches — **FIXED (partial, by design)**
- **Where:** `frontend-starter/components/shop/wishlist-button.tsx`, `components/chat-widget.tsx`.
- **Finding on closer look:** The two `.catch(() => {})` calls are on *background prefetches* (wishlist ids, chat history) — appropriately silent. The user-initiated actions already had feedback: chat **send** pushes an error bubble; wishlist **toggle** reverts the heart.
- **Fix (applied):** Added a clear transient failure state to the wishlist toggle (red ring + "Couldn't update wishlist — try again" title) so a failed toggle is obvious, not just a subtle revert. Left the background prefetch catches silent (noisy errors there would be worse UX).

### F15 — Homepage "quick reference" table showed blank Category/Description — **FIXED**
- **Where:** `frontend-starter/components/landing/range-table.tsx`; backend `ProductListOut`.
- **What was wrong:** The table read `product.category_name` and `product.description`, but the list endpoint returned neither, so both columns always showed `—`.
- **Fix (applied):** Added `description` to `ProductListOut` (backend); `RangeTable` now resolves the category name from the categories list passed by the homepage and shows the real description.

### F16 — Homepage second featured grid empty + misleading headings — **FIXED**
- **Where:** `frontend-starter/app/page.tsx`.
- **What was wrong:** Sections pulled only featured products (max 8), so with <8 featured the second grid was empty; and the headings ("Featured dust sheets", "Cotton dust sheets…") were fixed text unrelated to the products shown.
- **Fix (applied):** The homepage now tops up featured products with other active products to fill both grids, and uses honest generic headings ("Featured products", "More from our range").

---

## Homepage featured products (FIXED — commit pending)

Marking products as "Featured" in admin had no effect on the storefront homepage, and the
homepage sections showed emoji placeholders instead of the products' real images. Three
distinct bugs, all fixed:

### F12 — Homepage ignored the Featured flag (wrong query param)
- **Where:** `frontend-starter/app/page.tsx:17`.
- **What's wrong:** Fetched `/api/products?is_featured=true`, but the backend filter param is `featured_only`. The unknown param was ignored, so the endpoint returned **all** products (verified: `is_featured=true` → 181 results; `featured_only=true` → 3). The homepage showed the first 8 of all products regardless of the Featured flag.
- **Fix:** Changed the query to `featured_only=true`.

### F13 — Grid sections couldn't render real images (list-vs-detail shape)
- **Where:** `frontend-starter/components/landing/product-grid-section.tsx:51`.
- **What's wrong:** Read `product.images?.[0]?.url`, but the list endpoint (`ProductListOut`) returns `primary_image` and no `images` array. Images never resolved, so the section fell back to a gradient + 72px emoji.
- **Fix:** Read `primary_image` (with `images[0]` fallback) and resolve relative `/uploads/...` paths to the backend base — same class as **F8**.

### F14 — Hero "Best selling" card never showed product images
- **Where:** `frontend-starter/components/landing/hero.tsx:15-22,86`.
- **What's wrong:** Mapped each product to a hardcoded rotating emoji (`PRODUCT_ICONS[i % 4]`) and rendered that instead of the image.
- **Fix:** Render the product's `primary_image` (emoji only as fallback when a product has no image).

**Related design limitations (not bugs, noted for later):** the homepage shows at most 8
featured products (Hero + grid 1 = first 4; grid 2 = next 4), so grid 2 stays empty until
≥8 products are featured; and the section headings are fixed text, not derived from the
featured products' actual categories.

---

## Verified clean / already fixed

- **Async DB pattern:** every coroutine `commit/flush/refresh/delete/execute` is `await`ed; `.scalars()/.scalar_one()` calls are on already-awaited results. The recurring missing-`await` bug is not present.
- **`useSearchParams` Suspense:** `login` and `price-range-filter` (via `products/page.tsx`) are correctly `<Suspense>`-wrapped.
- **Stock oversell race:** `deduct_stock` (`products/service.py:244`) locks the row `for_update` and re-checks, preventing concurrent oversell at deduction.
- **Money mutations:** loyalty/credit/coupon usage all lock `for_update` and re-check; `reverse_order_points` math is correct; refresh-token rotation revokes the old token; `request_password_reset` avoids email enumeration (always 200).
- **Router authorization:** all 24 plugin routers carry auth guards. Every admin-content plugin (promotions, announcements, discount_rules, newsletter, shipping, categories, coupons, inventory, loyalty, credit, products) gates writes behind `require_admin`; customer plugins (addresses, wishlist, cart, checkout) use per-user scoping. `addresses`/`orders` ownership checks confirmed. No unguarded-write gaps found.
- **Branding save bug (FIXED):** `social_links` type mismatch (422 on every save) + silent failure — fixed and committed in `a1b97dc`.

---

## Automated test coverage added (2026-07-04)

The fixes above previously had only regression/smoke checks. New dedicated tests now
lock in the new behaviour:

- **`backend/tests/test_storefront_fixes.py`** (11 tests, all pass):
  - F8: add-to-cart by `product_id` resolves the default variant (guest + authed); missing both ids → 422; `variant_id` path still works.
  - F15: product-list response includes `description`.
  - Branding `social_links`: empty string → null (no 422), valid JSON string → dict, invalid string → null.
  - F9 dependencies: coupon-validate returns the discount amount; invalid code → `valid:false`; loyalty-config exposes `redemption_rate`.
- **`frontend-starter/e2e/cart.spec.ts`** — new F8 guard: after clicking Add-to-cart on the listing, the item actually appears on the cart page (not just a label flip). The old E2E only asserted the button label, which is why F8 slipped through.

Full backend suite now **211 passing**. Still **not** covered by automated tests (manual verification recommended): the admin Featured-toggle/thumbnail UI, the homepage rendering (F16), and the checkout discount *display* maths (F9 frontend) — only its API dependencies are tested.

---

## Not yet reviewed

Lower-risk areas not read line-by-line: minor CRUD plugins (`reviews`, `newsletter`, `rfq`,
`wishlist`, `shipping`, `ai_chat`, `announcements`, `promotions`, `contact`, `landing_page`,
`discount_rules`, `categories`) beyond their router guards; the admin frontend pages
(except branding); remaining storefront pages (product listing/detail, cart, account,
success, register/verify/reset); `main.py`, `config`, `security`, `seed.py`, migrations;
and the test suites.
