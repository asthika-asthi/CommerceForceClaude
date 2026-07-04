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

### B1 — Stripe payments mutate state before the card is charged
- **Where:** `backend/app/plugins/checkout/service.py` — stock deducted (188), coupon usage recorded (193), loyalty redeemed (198) and earned (233); webhook `handle_stripe_webhook` (~290).
- **What's wrong:** For Stripe, `checkout()` only creates a PaymentIntent — the card is confirmed later on the client. But stock/coupon/loyalty mutations run unconditionally *before* payment. The webhook only flips `payment_status`/`status`; it performs none of these mutations. There is no `payment_intent.payment_failed`/`canceled` handler, and `restore_stock` runs only on manual order cancellation. `get_db` commits on a 200 response.
- **Failure scenario:** Customer reaches the card step and abandons (or the card is declined client-side). The order persists with: decremented stock, a consumed coupon-usage count, spent redeemed points, and earned points for an order that was never paid. Nothing ever reverses these.
- **Fix direction:** For Stripe, defer stock/coupon/loyalty mutations to the `payment_intent.succeeded` webhook, and/or add a `payment_intent.canceled`/expiry handler that restores them. Cash/credit can keep the synchronous path. (See F10 — the frontend half.)

### B4 — A regular admin can self-escalate to superadmin (security)
- **Where:** `backend/app/plugins/auth/router.py:135` (`patch_user`), `auth/service.py:206`.
- **What's wrong:** `patch_user` is guarded by `require_admin()` (allows admin **or** superadmin), and the service does `UserRole(data["role"])` with no restriction on the target role.
- **Failure scenario:** Any `admin` calls `PATCH /api/auth/users/{id}` with `{"role":"superadmin"}` on any account (including their own) and gains full superadmin rights, defeating the admin/superadmin separation.
- **Fix direction:** Gate role changes behind `require_superadmin()`, or reject `role == "superadmin"` unless the caller is superadmin.

### F8 — Add-to-cart from product listings is broken (passes product id as variant id)
- **Where:** `frontend-starter/components/shop/product-card.tsx:24`, `components/blocks/commerce/featured-products-grid.tsx:42`, `app/account/wishlist/page.tsx:54`. Backend: `cart/service.py:127`.
- **What's wrong:** These call `addItem(product.id)`, but the cart store and backend expect a **variant id**. `add_item` looks up `ProductVariant.id == variant_id` and returns 404 for a product id, so nothing is added. product-card and featured-grid ignore the `false` return and still flash "Added!".
- **Failure scenario:** A shopper clicks "Add to cart" on the product grid, featured section, or wishlist. The item is never added; two of the three still show a green "Added!" confirmation. The existing E2E passes because it only asserts the button label, not cart contents.
- **Basis:** The product detail page (`add-to-cart-button.tsx:59`) correctly uses a real `variantId` and checks the boolean — proving variants have their own ids and the listings are wrong. Likely a loose end from when the cart became variant-based.
- **Fix direction:** Listings must add the product's default/selected variant id and honor the boolean result (show an error on failure).

---

## MEDIUM

### B5 — Password reset/change does not revoke existing sessions (security)
- **Where:** `backend/app/plugins/auth/service.py:243` (`reset_password`), `:182` (`change_password`).
- **What's wrong:** Both update the password hash but never revoke the user's `RefreshToken` rows. Only a single-token `revoke_refresh_token` exists; there is no revoke-all-by-user.
- **Failure scenario:** An account is compromised; the victim resets their password. The attacker's refresh token stays valid until natural expiry (`REFRESH_TOKEN_EXPIRE_DAYS`), so the attacker keeps access.
- **Fix direction:** On reset and change, mark all of that user's refresh tokens `revoked = True`.

### B2 — Explicit-items checkout ignores variant pricing
- **Where:** `backend/app/plugins/checkout/service.py:84` (`_items_from_explicit`).
- **What's wrong:** Prices at `product.effective_price` and sets no `variant_id`, whereas the cart path (line 76) adds `variant.price_adjustment`.
- **Failure scenario:** A variant product checked out via the explicit `data.items` path is charged the base price (undercharge) and the order line has no variant recorded.
- **Fix direction:** Resolve the variant + price adjustment in the explicit path, or remove the path if it is unused.

### F9 — Checkout order summary ignores discounts
- **Where:** `frontend-starter/app/checkout/page.tsx:423`.
- **What's wrong:** Displays `Total = subtotal + shipping`, omitting the coupon and loyalty discounts the backend actually applies.
- **Failure scenario:** The customer sees a total that doesn't match what they're charged (notably the Stripe PaymentIntent amount, which includes discounts). Coupon/points entry gives no visible effect.
- **Fix direction:** Reflect applied discounts in the summary — ideally via a server-side quote endpoint so the displayed and charged totals always agree.

### F10 — Order created before card confirmation (frontend half of B1)
- **Where:** `frontend-starter/app/checkout/page.tsx:165` (POST `/api/checkout`) then `:178` (`stripe.confirmCardPayment`).
- **What's wrong:** The order (and all B1 side effects) is created on the server before the card is confirmed on the client. On card failure/abandonment the frontend only shows an error; the backend order persists.
- **Fix direction:** Tied to B1 — defer side effects until payment success, or cancel the pending order when confirmation fails.

### B9 — `update_status` has no state-machine validation
- **Where:** `backend/app/plugins/orders/service.py:115`.
- **What's wrong:** Sets `order.status = data.status` to any target; only the →cancelled transition is guarded.
- **Failure scenario:** An admin moves a **cancelled** order (stock already restored) to `shipped`/`confirmed`. Stock is not re-deducted, so inventory is overcounted and a cancelled order gets shipped.
- **Fix direction:** Enforce an allowed-transition table (e.g. cancelled is terminal; can't ship without confirmed/paid).

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

### B8 — Cancelling an order never reverses coupon usage
- **Where:** `backend/app/plugins/orders/service.py` cancel paths (210, 106).
- **What's wrong:** Cancellation restores stock, credit, and loyalty points but never decrements `coupon.used_count` or removes the `CouponUsage` row.
- **Failure scenario:** A cancelled order that used a capped coupon permanently burns a use.
- **Fix direction:** Add a coupon-usage reversal on cancel (decrement `used_count`, delete/void the `CouponUsage` row).

### F11 — Minor silent catches
- **Where:** `frontend-starter/components/shop/wishlist-button.tsx:24`, `components/chat-widget.tsx:39`.
- **What's wrong:** Errors are swallowed with `.catch(() => {})`; a failed wishlist toggle or chat send gives no feedback.
- **Fix direction:** Surface a small error state; low priority (best-effort UX).

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

## Not yet reviewed

Lower-risk areas not read line-by-line: minor CRUD plugins (`reviews`, `newsletter`, `rfq`,
`wishlist`, `shipping`, `ai_chat`, `announcements`, `promotions`, `contact`, `landing_page`,
`discount_rules`, `categories`) beyond their router guards; the admin frontend pages
(except branding); remaining storefront pages (product listing/detail, cart, account,
success, register/verify/reset); `main.py`, `config`, `security`, `seed.py`, migrations;
and the test suites.
