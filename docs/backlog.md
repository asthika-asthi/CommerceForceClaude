# CommerceForce — Live Backlog

Last updated: 2026-06-29. This is the single source of truth for build status.

---

## Testing status key

- **Built + Tested** — code committed, manually verified end-to-end
- **Built, not tested** — code committed, NOT manually tested yet; save for one big test session
- **Not built** — no code exists; needs to be built

---

## Built + Tested

### Sprints 1–3
All of Sprints 1–3 were tested before Sprint 4 work began.
Core auth, products, categories, cart, checkout, orders (basic), branding, landing page, and storefront are verified working.

### Product variants (Sprint 8 — 2026-06-26)
Full variant system tested end-to-end via automated pytest suite (123 tests pass) and live API tests:
- Create product → default variant auto-created with matching SKU
- Add option types (Size, Colour) + values (S/M/L, Red/Blue) → generate 6 combinations
- Re-generate is idempotent (previously was a bug, now fixed)
- Variant SKU update, duplicate SKU rejected (409), active/inactive toggle
- Warehouse stock set and queried per variant_id
- Add variant to cart, update quantity, remove; cart displays variant_label
- Simple product (no options) still uses default variant transparently
- Delete option type → all variants deactivated (not deleted, preserves order history)
- Admin frontend: Variants tab (option CRUD, generate button, SKU/active table)
- Admin frontend: Inventory page uses variant picker
- Storefront: variant picker dropdowns on product page; cart shows variant label
- Migration script (`scripts/migrate_variants.py`) tested: creates new tables, adds columns, recreates warehouse_stock and cart_items with correct schema, creates default variants for all existing products

**Two bugs found and fixed during testing:**
- `generate_variants`: re-generate crashed (500) because matched existing variants lacked loaded relations — fixed by loading full chain in initial query
- `migrate_variants.py`: used wrong engine import name, failed to import models before `create_all`, missing ALTER TABLE steps, and needed table recreation for NOT NULL constraint removal

### Sprints 4–7 comprehensive test (2026-06-27)
All 33 "Built, not tested" backlog items tested end-to-end via 112 live API tests (all pass).

**Shipping zones:** Create/update/delete zones (countries as string), rate calculation by country code.

**Rate limiting:** 429 returned after 5+ failed login attempts per minute from same IP.

**RFQ plugin:** Customer creates draft → submits → admin marks as under review.

**Credit plugin:** Admin creates account with limit, customer views balance, admin updates limit, DELETE account, credit used on checkout is restored after admin cancel.

**Inventory:** Create warehouse (requires `code` field), set/adjust stock per variant, low-stock threshold detection, DELETE non-default warehouse.

**Wishlist:** Add product (URL route `POST /api/wishlist/{product_id}`), list, remove.

**Newsletter:** Subscribe, admin list/update/delete subscribers, CSV export.

**Addresses:** Save default address, list, update label.

**Discount rules:** Create rule, GET single, list all.

**Loyalty:** Admin list all accounts, customer views own balance, points earned on order, points reversed after admin cancel.

**Coupons:** Homepage enforcement — server ensures only one `show_on_homepage=True` at a time (fixed: `CouponCreate` and `CouponUpdate` now include `show_on_homepage` field, create enforces uniqueness). DELETE coupon.

**Orders (full flow):** Checkout via `POST /api/checkout` (not `/checkout/place`), `shipping_address` is a plain string, payment methods are `cash`/`credit_limit`/`stripe`. Admin delivers (`PUT /status`), admin cancels → credit restored and loyalty reversed.

**Reviews:** Only customers with a delivered order for that product can submit. Approve via `PATCH /api/reviews/{id}/approve`. Author edit re-queues for approval.

**Order tracking:** `PATCH /api/orders/{id}/fulfil` sets tracking number and marks shipped. Customer sees tracking number.

**CSV exports:** Orders and Products CSVs return content correctly.

**Product duplicate finder:** Endpoint returns list/dict (no duplicates in test data).

**Media upload:** Upload PNG via `POST /api/media/upload`, returns URL.

**Seven bugs found and fixed during testing:**
- `orders.shipping_cost` column missing from DB — added via targeted migration
- `shipping` plugin not in `ENABLED_PLUGINS` — added
- `shipping_zones` table not created — created via `create_all`
- `CouponCreate`/`CouponUpdate` missing `show_on_homepage` field — added to schemas and service
- Wishlist remove: missing `await db.flush()` after `db.delete(item)` — added
- Cart items returning 409 when `product.stock_quantity = 0` — test now filters for in-stock products
- Checkout response field is `order_id` not `id` — test fixed

**Items intentionally not API-tested (require special setup):**
- Stripe refund — no Stripe test credentials
- Backup cron — Docker only
- AI chat — no OPENROUTER_API_KEY
- Analytics charts — UI charts, no dedicated data endpoint
- SEO meta tags — requires browser/`<head>` inspection
- GDPR consent banner — localStorage-based, frontend only

### Full app verification + bug fixes (2026-06-29)

Comprehensive live test of every plugin and every user-facing flow. All items below confirmed working end-to-end.

**Storefront flows tested:**
- Home page, product listing, product detail (with and without variants)
- Category filter via top nav (by `category_id`) and sidebar
- Add to cart → update quantity → remove; cart persists across page navigation
- Guest checkout (cash, GB shipping applied correctly)
- Coupon code validation (`GET /api/coupons/validate?code=X&subtotal=N`)
- User registration → login → account page
- Wishlist: add, list, remove
- Password show/hide toggle on all password fields (login, register, reset, account, trade)
- Trade account application form
- Newsletter subscribe
- Contact form submit
- AI chat widget renders correctly; shows graceful error when no API key is set

**Admin flows tested:**
- Product CRUD (create, PUT update, delete); new product appears in storefront immediately
- Category CRUD
- Branding config GET and PUT
- Order list, detail, status update (PUT)
- Coupon CRUD and homepage featured coupon
- Discount rules CRUD
- Inventory warehouses and stock
- Loyalty config and account list
- Announcements CRUD (create, list, active public endpoint, delete)
- Reviews admin list
- RFQ submit and admin list
- Credit admin account management
- Addresses CRUD
- Shipping zones (admin) and rate calculation (public)
- User admin list

**Per-variant pricing (2026-06-29) — promoted from "Built, not tested":**
- Admin: set price adjustment on variant → saves → reloads correctly
- Storefront product page: selecting a variant updates the displayed price live
- Cart and checkout: adjusted price used in line totals and order total
- Storefront product detail page loads with correct product name in SSR HTML

**Bugs found and fixed (commits 9dad65d, ccab0c5):**
- Top nav category links used `cat.slug` → now use `cat.id` (products were never filtered)
- `EditProductPage` declared `async` in a `"use client"` file → fixed with `React.use(props.params)`
- `ImageUpload` posted to relative `/api/media/upload` → now posts to absolute backend URL
- CORS origins missing `localhost:3000` and `localhost:3001` → added to `.env`
- `ENVIRONMENT=production` in dev `.env` → refresh cookie had `Secure` flag, blocking localhost auth
- `announcements` plugin missing from `ENABLED_PLUGINS` and no DB table → migration added, plugin enabled
- Auto discount rules with `discount_value < 0` were adding a surcharge to every order total → bad seed data deleted; `evaluate_rules()` now filters negative values and invalid types at the DB query
- Loyalty admin page showed "Points per Dollar" / "$" labels on a GBP store → fixed to "Points per £1" / "£"
- 4 duplicate "10% off over £50" discount rules left over from testing → deleted

**Configuration items (not code bugs):**
- AI chat returns 503 until `OPENROUTER_API_KEY` is set in `.env` — handled gracefully by chat widget
- Stripe payment method returns 503 until `STRIPE_SECRET_KEY` is set — correct behaviour

### Component library sprint (2026-06-28)

Blocks directory reorganised into four categories (layout / visual / commerce / content). 8 new block components added. Variant picker refactored from `<select>` dropdowns to pill buttons.

**Directory reorganisation:**
- All 22 existing blocks moved into `components/blocks/layout/`, `visual/`, `commerce/`, `content/` subdirectories.
- Registry keys unchanged — no config JSON changes needed.

**8 new blocks registered in block-registry.ts and block-defaults.ts (storefront + admin):**
- `glassmorphism-hero` — full-bleed image with frosted-glass card overlay
- `parallax-banner` — fixed-background parallax banner with CTA
- `marquee-ticker` — continuously scrolling trust signals strip
- `gradient-text-section` — impact statement with CSS gradient heading text
- `image-mosaic` — staggered image grid (up to 6 images, alternating tall/short)
- `split-image-text` — two-column image + text layout, image side configurable
- `animated-counter` — stats row that counts up on scroll into view (uses framer-motion)
- `bento-grid` — asymmetric card grid with one large feature card + smaller cards

**Variant picker refactor:**
- `app/products/[slug]/variant-picker.tsx` — replaced `<select>` dropdowns with pill buttons; out-of-stock values shown as greyed strikethrough pills (still clickable); `aria-pressed` + `role="group"` for accessibility.
- `app/products/[slug]/add-to-cart-button.tsx` — button shows "Out of stock" and disables when selected combination maps to an inactive variant; picker stays mounted so selections are preserved.
- OOS pill detection is per-combination: selecting one option greys out values in other groups that would form an inactive combination. Per-combination narrowing shipped and tested 2026-06-29.

**Admin block-defaults sync:** 3 previously missing entries (`promotions-banner`, `announcement-bar`, `coupon-spotlight`) added to `frontend-admin/lib/block-defaults.ts`.

---

## Not built — Priority 4 (medium, plan before building)

| ID | Feature | Notes |
|----|---------|-------|
| P | 2FA for admin | TOTP flow, QR setup, backup codes. Separate sprint. |
| R | Per-client git branch script | `scripts/new-client.sh` to automate `git checkout -b client-name` + seed template copy |
| S | Bulk image assignment via product CSV | Add optional `image_url` column to product import CSV; on import, create a `ProductImage` record linked to the product. Allows full product setup (including hero image) in one CSV upload without clicking through each product. |

---

## Not built — Product variants v2 (remaining items)

| Feature | Notes |
|---------|-------|
| ~~Variant picker — per-combination OOS narrowing~~ | **Done** — shipped 2026-06-29. Pills narrow based on current selections across all option groups. |
| ~~Variant images~~ | **Built, not tested** — `variant_id` on `ProductImage`; admin dropdown to assign images to variants; storefront auto-switches main image when variant selected. Migration: `e2f3a4b5c6d7`. |
| ~~Bulk variant import via CSV~~ | **Built, not tested** — global CSV format, two stock modes (set/add), per-row error reporting, export round-trip. 46 automated tests pass. Admin UI at /bulk-variants. Needs manual browser smoke test. |
| ~~Warehouse-to-warehouse stock transfers at variant level~~ | **Built, not tested** — `POST /api/inventory/transfers`, atomic deduct+credit, dest auto-created, 24 tests pass. Transfer Stock card on inventory page. Needs manual browser test. |

---

## Not built — Priority 5 (HTTPS activation, blocks live clients)

HTTPS is not blocking development but IS required before any client goes live.

**Preparatory work is already done:**
- `nginx/default.conf` — nginx config with HTTP → HTTPS redirect and SSL block
- `nginx/entrypoint.sh` — envsubst startup script
- Section 12 of `docs/new-client-setup.md` — complete step-by-step instructions (certbot, DNS, port changes)
- `docker-compose.yml` has the nginx and certbot service definitions, commented out

**What to do when a client is ready for a live domain:**
1. Get the domain name from the client
2. Point DNS A record to the VPS IP
3. Follow `docs/new-client-setup.md` Section 12 exactly (all commands are there)

---

## Intentionally deferred (not planned for now)

### Security / Infrastructure (ops responsibility)
- `SECRET_KEY` — randomly generated per deployment, never committed
- `DATABASE_URL` — SQLite for dev only; PostgreSQL required for production at scale
- `SMTP_*` — per-client email provider, set at deploy time
- `OPENROUTER_API_KEY` — per-client billing, never committed to git
- `CORS_ORIGINS` — depends on hosting domain, set at deploy time

### Backend
- **Media upload: magic bytes check** — `content_type` is client-supplied and can be spoofed; real fix requires `python-magic`; accepted trade-off for internal tool
- **Admin credentials in seed.py** — `admin@commerceforce.dev / Admin1234!` hardcoded; must be changed before any real deployment

### Frontend / Admin
- **Image management** — **Built and tested (API)** — Media Library supports folder-based organisation (`/uploads/folder/filename.jpg`), grouped display, folder input on upload, and delete. Docker bind-mounted to `./uploads/`. 21 API tests pass (upload, list, delete, overwrite, path traversal, static serving, directory listing blocked). Browser UI still needs manual verification.
- **Product barcode + multi-image** — **Built, not tested** — `barcode` field added end-to-end (DB, migration, schemas, CSV import/export, both admin forms). Admin create page now has full multi-image panel (add URL or upload, set primary, delete, reorder). Storefront product card respects `is_primary` flag for thumbnail. Needs manual browser test.
- **WCAG contrast validation** — no automated check that brand colours meet WCAG AA; manual check required
- **Font via next/font/google** — config `"brand.font"` injects a runtime Google Fonts link tag (works); for peak performance also update the `next/font/google` import in `layout.tsx` and rebuild

### Developer experience
- **CI/CD pipeline** — out of scope until product is ready for market
- **`ENABLED_PLUGINS` / config divergence** — frontend reads config `"plugins"` list; backend reads `.env`; if they diverge, a block appears but its API returns 404 (handled gracefully)
- **Visual preview tool** — live preview of `landing-page.config.json` without running full dev stack
- **Component library builder** — systematic process for sourcing new block components; currently ad-hoc
