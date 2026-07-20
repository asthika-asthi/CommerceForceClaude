# CommerceForce — Live Backlog

Last updated: 2026-07-16. This is the single source of truth for build status.
Bug-review findings and their fix status live in `docs/bugs-log.md`.
Forward-looking gaps, per-profile coverage, and the multi-tenant question live in
`docs/gap-analysis-and-roadmap.md`.

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

### Admin search + pagination (2026-07-01)

Search and pagination added to all 7 admin list pages. 200/200 backend tests pass (including 29 new pagination tests).

**Backend changes (all endpoints now return `{ items, total, page, page_size, pages }`):**
- `GET /api/auth/users` — paginated with `page`/`page_size` query params
- `GET /api/newsletter/subscribers` — paginated (CSV export unchanged, uses separate service function)
- `GET /api/reviews/admin/all` — paginated; `is_approved` filter now server-side
- `GET /api/contact` — paginated
- `GET /api/rfq` — `pages` field was missing from `RFQPageOut` schema — fixed

**Frontend changes (all admin list pages):**
- `components/ui/pagination.tsx` — shared Prev/Next pagination component (only renders when > 1 page)
- `lib/types.ts` — `Paginated<T>` generic interface added
- Products: search input with 300ms debounce + pagination; search resets to page 1
- Orders: pagination (was silently ignoring `?limit=50`; now correctly uses `?page=N`)
- RFQ: pagination (same fix as orders)
- Users, Newsletter, Reviews, Enquiries: pagination added to all four

**Pre-existing bug fixed:** `db.delete(product)` in `products/service.py` was missing `await` — caused `test_delete_duplicates_keeps_selected` to fail.

**Playwright E2E tests written** (`frontend-admin/e2e/pagination.spec.ts`, 16 specs):
- Products: search filtering, empty-result state, clearing search, search resets page
- Products: pagination Prev/Next navigation, disabled states, page counter
- Enquiries: pagination Prev/Next
- Newsletter: pagination, filter toggle resets to page 1
- No-data: pagination hidden when < 20 records

**To run E2E tests:** start backend on `:8000` and admin on `:3001`, then `npm run test:e2e` from `frontend-admin/`.

---

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

### Bug review + storefront/admin fixes (2026-07-04)

Full-codebase bug review documented in `docs/bugs-log.md` (13 findings + verified-clean areas). Fixes made this session:

**Built + Tested (automated — `backend/tests/test_storefront_fixes.py`, 11 tests; new cart E2E; suite now 211 passing):**
- **Branding config save** — `social_links` type mismatch caused HTTP 422 on *every* save; now accepts empty/JSON/invalid strings, and save failures surface an error instead of failing silently. (commit `a1b97dc`)
- **Add-to-cart from listings (bug F8)** — product grid / featured / wishlist passed a *product* id where a *variant* id was expected, so nothing was added while the card still flashed "Added!". Cart API now accepts `product_id` and resolves the product's default variant; listings honor the result. New E2E asserts the item actually lands in the cart. (commit `41b35bf`)
- **Product list API returns `description`** — homepage "quick reference" table now shows real category + description instead of "—" (bug F15). (commit `d0fad8b`)
- **Checkout discount API dependencies** — coupon-validate amount and loyalty-config rate covered by tests.

**Built, not tested (needs manual browser check):**
- **Admin Products page** — image thumbnail column (valid / grey "no image" / red "broken URL" states) to spot wrong or missing product images; **"Featured" checkbox** added to the new + edit product forms (backend already supported `is_featured`; only the UI was missing). (commit `f1406b0`)
- **Homepage now honors the Featured flag** — was querying the wrong param (`is_featured` instead of `featured_only`), so it ignored featured products; now shows real product images in the hero + grids (bugs F12–F14), tops up featured with other active products so both grids stay filled, and uses honest section headings (bug F16). (commits `66ae4c6`, `d0fad8b`)
- **Checkout order summary** now shows coupon + loyalty discount lines and a correct total (bug F9 display maths); **wishlist toggle** shows a clear failure state (bug F11). (commit `d0fad8b`)
- Fixed a pre-existing type error in `product-search-combobox.tsx`.

**Security + payment fixes (done 2026-07-04, tested):**
- **B4 (HIGH, security) — FIXED:** role changes via `PATCH /api/auth/users/{id}` now require superadmin, so an admin can no longer escalate itself/anyone to superadmin. (`tests/test_security_fixes.py`)
- **B5 (MED, security) — FIXED:** password change/reset now revokes all of the user's refresh tokens, so existing sessions can't be refreshed afterward. (`tests/test_security_fixes.py`)
- **B1 (HIGH) — FIXED:** Stripe stock/coupon/loyalty effects are deferred to the `payment_intent.succeeded` webhook (cash/credit still synchronous), so an abandoned card checkout no longer oversells stock or consumes coupons/points. (`tests/test_checkout_deferral.py`)
- **B8 (MED) — FIXED:** cancelling an order now reverses coupon usage (customer + admin paths). (`tests/test_order_lifecycle.py`)
- **B9 (MED) — FIXED:** `update_status` now rejects illegal transitions (cancelled/delivered are terminal). (`tests/test_order_lifecycle.py`)
- **B2 (MED) — FIXED:** explicit-items checkout now resolves the variant (explicit or default), applies its price adjustment, and records `variant_id`. (`tests/test_explicit_checkout.py`)
- **B6 — FIXED:** coupons are now one redemption per customer (authenticated). (`tests/test_coupon_per_user.py`)
- **B7 — FIXED:** email verification required — unverified customers are blocked from login (behind `REQUIRE_EMAIL_VERIFICATION`, default on), with a resend-verification flow. (`tests/test_email_verification.py`)

**All review findings B1–B9 are now fixed except B3 (deferred). `docs/bugs-log.md` is the detailed record.**

---

### VPS stability fixes + per-client currency (2026-07-05)

**Built + Tested (automated):**
- **SQLite concurrency hang** — engine now uses WAL + busy_timeout (backend was wedging under the superadmin's setup activity, needing a restart). (`tests/test_stability_fixes.py`)
- **`COOKIE_SECURE` setting** — refresh cookie Secure flag is configurable so HTTP-only deployments work. (`tests/test_stability_fixes.py`)
- **Admin category list `include_empty`** — imported categories now show in admin before products exist. (`tests/test_stability_fixes.py`)
- **Per-client currency** — `CURRENCY_CODE` / `NEXT_PUBLIC_CURRENCY_CODE` (default GBP) drives price symbols + Stripe charge currency + order emails. Backend fully unit-tested (symbols, format, Stripe, email); storefront price rendering covered by E2E. (`tests/test_currency.py`, `frontend-starter/e2e/currency.spec.ts`)

**Built, NOT tested — needs manual browser verification:**
- **Login-error display fix** — admin/storefront login now shows the real error instead of flashing + reloading (api.ts no longer runs refresh-redirect on `/api/auth/*`). *tsc-clean only; verify a wrong-password login keeps the message on screen.*
- **Media library "Copy URL" over HTTP** — clipboard fallback for non-secure contexts. *Verify copy works on the VPS (HTTP) — no automated test.*
- **Currency in a non-GBP deployment** — only the GBP default is E2E-tested. *Deploy one client with `CURRENCY_CODE=USD` (or similar) and confirm the storefront + admin show the right symbol and Stripe charges in that currency.*
- **Admin currency labels** — Credit/Loyalty/Discount/Shipping/Products label symbols were bulk-replaced; tsc-clean but not visually reviewed per page.
- **Frontend `formatMoney` unit logic** — no JS unit-test runner is set up (only Playwright). Logic mirrors the tested backend `format_money`; a vitest setup would close this gap.

**Deploy note:** currency is build-time — set `CURRENCY_CODE` in the root `.env`, then rebuild the frontends (`docker compose build frontend-starter frontend-admin`). HTTP deploys also need `COOKIE_SECURE=false`. See `docs/new-client-setup.md`.

---

### Configurable theme colours + best-seller switch + optional store name (2026-07-09)

**Branch:** `feat/theme-colors`. Background: investigation showed the admin panel's old
Primary/Secondary colour pickers saved to the DB but the storefront never applied them,
and ~80 raw colour values were hardcoded across storefront components — colours could
only be changed by editing code. This sprint makes colours admin-configurable end-to-end.

**Built + Tested (automated):**
- **`theme_colors` on branding** — native JSON column + migration `f4a5b6c7d8e9`; PUT/GET round-trip, defaults-empty, non-admin 403, blank-store-name round-trip all covered. (`tests/test_content.py`)
- **Migration chain** — `alembic upgrade head` runs clean end-to-end on a fresh DB and is idempotent on re-run.

**Built, NOT tested — needs manual browser verification:**
- **Hybrid Colours panel** (admin → Branding): 5 core pickers (brand / dark / accent / background / text) with auto-derived shades shown as swatches; "Advanced" expandable overrides any individual shade; contrast warnings; reset-per-colour and reset-all. Old Primary/Secondary fields removed. *tsc-clean; verify picking a colour, overriding a shade, and both resets in the browser.*
- **Storefront applies DB colours** — layout injects derived CSS variables as inline style on `<html>`, overriding `themes/default/globals.css` defaults; empty `theme_colors` = site unchanged. *Verify: change brand colour to yellow in admin → storefront buttons/tints follow with dark button text (`--on-brand` guardrail), no red leftovers on home/products/cart/footer.*
- **De-hardcode sweep** — ~80 raw hex values across 40+ storefront files converted to ~24 named tokens (new: brand-tint, brand-highlight, brand-shadow, on-brand, dark-deep, dark-border, on-dark ×4 tiers, accent, accent-hover, surface-alt, text-placeholder, border-subtle). Deliberate exceptions kept hardcoded: status greens/ambers/reds, Trustpilot green, pastel image-placeholder gradients, Stripe input theme, decorative shiny-button gradients. Also fixed a latent bug: `text-muted` was mapped to card-bg (near-white text on white). *Verify the site is pixel-equivalent to before while no colour is set.*
- **Best-seller card switch** — `homepage.showBestSellersCard` in `landing-page.config.json` (superadmin, per client branch); hero re-flows full-width when off. First real wiring of the config file.
- **Optional store name** — blank name now fully supported: navbar logo-only (no fake "ST" monogram), footer hides badge/name and cleans the copyright, tab title falls back to tagline. (Note: the live DB already had `store_name: " "` — the client had tried to blank it.)

**Shared logic note:** colour derivation lives in `frontend-starter/lib/theme-colors.ts` with a synced copy at `frontend-admin/lib/theme-colors.ts` (apps share no package — same discipline as type-sync).

**Deploy note:** run `docker compose exec backend alembic upgrade head` after pulling; no seed changes needed (empty `theme_colors` keeps current appearance).

---

### Commercial-readiness batch: Tax/VAT, Analytics, Abandoned-cart, Guest tracking, GDPR (2026-07-09)

**Branch:** `feat/commercial-readiness`, 8 commits (5 features + 3 standalone bug fixes surfaced along the way).
Closes the five gaps in `gap-analysis-and-roadmap.md` Part B that came up first in client conversations —
none blocked launch, but all five are standard Shopify/Woo-parity asks.

**Built + Tested (automated — 360 backend tests passing, ruff/mypy clean, both frontends tsc+build clean):**

- **Tax/VAT** — new `tax` plugin (per-country rate zones, mirrors `shipping` exactly). Checkout computes VAT on the discounted subtotal; flows through to order total, CSV export, confirmation email, and admin/storefront order-detail pages (which previously showed no shipping line either). Admin UI at Settings → Tax. (`tests/test_tax.py`, `tests/test_tax_checkout.py`)
- **Analytics (GA4 / Meta Pixel)** — `BrandingConfig.ga4_measurement_id`/`meta_pixel_id`, strictly validated server-side (a `<script>` tag is a much higher-severity injection surface than `custom_css`'s `<style>` tag, so unlike that field this one does *not* accept free text). Loads via `next/script` only after the visitor accepts the cookie banner; reacts live to accept/decline via a custom event. Cookie-consent and cookie-policy copy updated (used to assert "no tracking cookies are ever used").
- **Guest order tracking** — public `POST /api/orders/track` (order number + email, enumeration-safe like forgot-password, rate-limited) and a `/track-order` page. Order-detail presentation extracted into a shared component so the authenticated account page and the new public page can't drift. Confirmation email and checkout-success page now link to it (the latter previously linked guests to an authenticated-only URL that 404s for them).
- **Abandoned-cart recovery** — no task queue existed anywhere in this codebase (Celery/Redis were listed as dependencies but never wired to a worker/broker — corrected in `gap-analysis-and-roadmap.md`, which had claimed otherwise). Added an in-process APScheduler job instead of standing up Celery+Redis+a worker container from scratch. Guest carts now capture a recovery email via a dismissible cart-page prompt (previously impossible — guest carts had no email until checkout); logged-in carts use the account email. One reminder per abandonment; a cart's reminder flag resets if it's modified again.
- **GDPR export + delete** — self-service JSON export (`GET /api/auth/me/export-data`, immediate — non-destructive). Deletion is request-then-admin-approval (mirrors the RFQ draft/submitted/reviewed status shape) — approval anonymizes the account in place, never a hard delete: orders survive per the privacy policy's 7-year retention commitment but have free-text PII redacted; reviews keep their body text but are unlinked from the author. Admin UI at Data Requests.

**Bugs found and fixed along the way (not scoped to any one feature above):**
- **`OrderOut` never exposed `shipping_cost`** — the column has existed since the shipping plugin shipped, but the schema behind `GET /api/orders/{id}` never declared it, so the admin/storefront order-detail Shipping rows (added for tax) would have silently never rendered.
- **SMTP was completely broken** — `aiosmtplib` 5.x made `message` positional-only; the existing call passed it as a keyword, raising a `TypeError` on every send attempt, silently masked by the console-fallback path. Also `subject` was never passed to `aiosmtplib` at all, so even a working send would have gone out with no Subject line. Every prior "email sent" claim in this codebase was actually just a print statement. Fixed by building a proper `EmailMessage`; verified live — sends now reach the real SMTP server and fail only on auth (no password configured), not the old `TypeError`.
- **`addresses` and `wishlist` plugins had zero test coverage** — neither was in the test suite's `ENABLED_PLUGINS`, so their tables were never created in the test DB and their endpoints were never exercised by any test, until the GDPR tests (which call both) exposed it.
- **Reviews INNER JOIN would have hidden anonymized reviews** — `reviews.user_id` had to become nullable for GDPR unlinking; the two admin/storefront review-listing queries used `INNER JOIN` on that column, which would have silently dropped an anonymized review from listings instead of just losing its author name. Changed to `LEFT JOIN` with a "Former customer" fallback.

**Built + Tested (Playwright E2E, added 2026-07-10) — closes the five "needs manual browser verification" items above:**
- `frontend-starter/e2e/analytics.spec.ts` — GA4/Meta Pixel script tags actually appear/don't appear in the DOM tied to cookie accept/decline/no-decision, and persist across a reload. Had to poll for the homepage's cached branding fetch (`revalidate: 60`) to pick up admin-set IDs, same pattern as `theme-colors.spec.ts`.
- `frontend-starter/e2e/cart-recovery.spec.ts` — guest cart shows the save-your-cart prompt, submitting an email hides it, dismiss works, empty cart shows no prompt.
- `frontend-starter/e2e/gdpr-account.spec.ts` — account Settings Privacy section: download-my-data triggers a real file download, delete-account confirm dialog cancel/submit, pending-status copy.
- `frontend-admin/e2e/tax-zones.spec.ts` — Settings → Tax Zones create/edit/delete through the actual table UI.
- `frontend-admin/e2e/deletion-requests.spec.ts` — Data Requests page reject-with-notes and approve-and-anonymize flows.

Two rate limits on the backend (`/api/auth/register` 3/min, `/api/auth/login` 5/min) mean these specs retry-with-backoff on 429 and can take longer when run back-to-back with other specs that also register/log in — this is a pre-existing characteristic of the auth endpoints, not a bug in the new tests. Also surfaced two **pre-existing, unrelated** E2E flakes while verifying (not fixed, out of scope of this batch): `theme-colors.spec.ts` uses a 90s `expect.poll` inside a test with no `test.setTimeout` override, so the global 30s default can kill it before the poll finishes; `pagination.spec.ts` logs in as admin 15 times in one file, which alone brushes up against the 5/min login limit on a slow run.

**Deploy note:** run `docker compose exec backend alembic upgrade head` after pulling (4 new migrations: `tax_zones` table, `branding_config` analytics columns, `carts` recovery fields, `data_deletion_requests` table + `reviews.user_id` relaxed to nullable). Add `tax` to `ENABLED_PLUGINS` if the client needs VAT. New Python dependency: `apscheduler`.

---

### Per-client UI pipeline — Phase 1 wiring (2026-07-16)

**Branch:** `feat/ui-pipeline` (NOT merged — awaiting test session).
**Spec:** `docs/superpowers/specs/2026-07-16-per-client-ui-pipeline-design.md`.
**Plan:** `docs/superpowers/plans/2026-07-16-ui-pipeline-phase1.md`.

**Built + Tested (automated):**
- Homepage now renders via `landing-page.config.json` `sections[]` →
  `LandingSectionRenderer` → `BLOCK_REGISTRY` instead of hardcoded imports.
  Pixel-identity guarded by a characterization E2E
  (`frontend-starter/e2e/landing-pipeline.spec.ts`, 12 content anchors in
  order): frozen before the rewire, re-verified after (3/3 pass), plus a
  pipeline-proof assertion on a `data-landing-source` attribute.
- 11 original landing components registered as coarse-wrapped `landing-*`
  blocks; live product/category data flows via a new `acceptsData` registry
  flag + `data` prop on the renderer. Existing blocks untouched.
  Production build re-verified: homepage still prerenders Static with 60s
  revalidate — no SSR/caching regression.
- Config consolidation: the active config's never-rendered 19-section mockup
  `sections[]` replaced with the real 12-entry list; snapshot + surviving
  variants archived under `frontend-starter/config-archive/` (tracked).
  `landing-newsletter` entry declares `requiredPlugin: "newsletter"`.
- Clutter: leftover agent worktree removed (design docs moved to
  `docs/design-sources/`), root dev DB + local Claude settings gitignored,
  stale gitignore entries for the moved config variants dropped, invalid
  `gc.pruneexpire` entry removed from `.git/config` (was erroring on every
  commit).
- `frontend-starter/CLAUDE.md`: bulk find/replace + hand-edit procedure
  replaced with the block/config authoring procedure (Step 3 rewritten,
  Key Files + checklist updated).

**Data-loss notes (honest record):**
- Two of the four archived config variants (`_1`, `_2`) turned out to be
  identical, already-corrupted (invalid JSON) duplicates predating this work
  and were dropped; they were never git-tracked, so no valid version exists.
- The stray root `themes/default/globals.css` (a 12-line TTG token file) was
  deleted by an untracked-file cleanup mid-sprint before it could be
  archived; its palette (`#B6C1A1` / `#A3AE8E` / `#0D3328`) survives in the
  archived TTG config's `brand` block. `config-archive/README.md` documents
  both losses.

**Built, NOT tested — needs manual browser verification:**
- Side-by-side visual pass of the homepage vs. production during the next
  big test session — the E2E freezes content/order, not pixels.

**Known issues logged (pre-existing, NOT from this work):**
- The full storefront E2E sweep currently has ~15 pre-existing failures
  beyond the two flakes previously documented (booking, cart, cart-recovery,
  checkout-payment-methods, currency, gdpr-account, order-tracking,
  product-card-variant-guard) — all reproduced identically on the
  pre-rewire commit; looks like rate-limit/shared-state interference
  between suites. Needs its own investigation session.
- Follow-up (minor): the renderer's `section as unknown as LandingSection`
  cast at the config/DB type boundary would be cleaner as a discriminated
  union; and 17 pre-existing lint errors remain on untouched lines (5 of
  them in the otherwise-touched landing-section.tsx).

**Next:** Phase 2 pilot (new client via design-capture) → Phase 3 component
library session (backlog item Q). Item W's config-vs-DB content layering
decision is still deferred.

---

### Per-client UI pipeline — Phase 2 pilot: Surkut Miniatures (2026-07-18/19)

**Branches:** shared `feat/ui-pipeline-phase2` (off master, mergeable), client
`client/surkut` (off the shared branch, **NEVER** merged — the client's living
deployment). Phase 1 was merged to master 2026-07-18 (local, not pushed). Plan:
`docs/superpowers/plans/2026-07-18-ui-pipeline-phase2-surkut.md`. Design source:
the client's own repo (github.com/asthika-asthi/Surkut) — a finished single-page
site, brought in via the page-intake procedure.

**Built + tested (automated):**
- **7 new library blocks** (all token-styled, registered, reusable by any
  client): `spotlight-hero`, `pricing-tiers`, `showcase-gallery`,
  `video-showcase`, `stream-spotlight`, `faq-accordion`, `enquiry-form`.
  `enquiry-form` posts to the existing `contact` plugin (POST /api/contact,
  verified 201) and is plugin-gated.
- **Shared theme plumbing**: optional `--heading-family` (→ `font-heading`) and
  `--emphasis-surface` tokens (both fall back to Tri Star values → no visual
  change for Tri Star); `how-to-order` handles 5 steps + token bg.
- **Dark-theme readiness sweep**: hardcoded `bg-white` → `bg-card-bg` and three
  selected-state `bg-brand-dark` → `bg-emphasis-surface` across shared
  shop/account/block surfaces (Tri Star `--card-bg` is #FFFFFF, so
  pixel-identical). Guarded by the landing + cart + product-listing E2E (13/13).
- **Surkut homepage**: dark gold theme, Cinzel/Raleway fonts, 9 config sections,
  zero hand-edited page code, real client assets (portfolio images + stream
  videos). E2E on `surkut.db`: landing anchors, pipeline proof, commission
  enquiry submission, cart + product-listing (with product images) — all pass.
- Plugin gating verified **config-driven**: `getFilteredSections()` gates on the
  config's `plugins` array (not backend `ENABLED_PLUGINS`) — enquiry-form drops
  cleanly when `contact` is absent (9→8 sections).
- `docs/add-a-client-ui.md` — the repeatable procedure (Phase 2 step 5), with
  the real local-dev gotchas (config-driven gating, export-.env + alembic before
  seed, `git add -f` for images, dev first-compile flake).

**Built, NOT manually tested — needs the big session:**
- Literal side-by-side visual pass of BOTH clients: Tri Star (must be unchanged
  after the token sweep) and Surkut (vs the design-source repo).
- **Real Stripe payment**: `.env` has no Stripe test keys, so a paid order was
  not placed — cart→checkout reachability is E2E-covered, full order is not.

**Pending client input (Surkut):** confirm contact email, Instagram/Patreon
URLs, real logo/favicon if wanted, Display-tier deposit pricing.

**Note (no-Docker seeding):** `seed.py` reads identity vars via `os.getenv`, so
it needs `.env` present in the process environment. In Docker that's automatic —
`docker-compose.yml` uses `env_file: ./backend/.env`. Running `seed.py` **bare**
(no Docker) just needs `.env` exported into the shell first (see
`docs/add-a-client-ui.md`). No dependency needed.

**Bug found + fixed during Surkut manual testing (2026-07-20):** the topbar's
physical address ("📍 Redwings Farm, Stevenage...") was hardcoded literal text
in `components/layout/topbar.tsx`, unlike phone/email on the same line (which
correctly read from admin Branding). Every client cloned from the template
showed Tri Star's real address with no field anywhere — admin or config — able
to change it. `getTopbarSection()` in `lib/landing-config.ts`, which looked
like it might be the source, is dead code — nothing calls it.

Fixed on this branch: `Topbar` now reads `store.address.display_short` from
`landing-page.config.json` via a new `getStoreConfig().address` field (typed
`StoreAddress`), passed down from `app/layout.tsx`. Deliberately **no
hardcoded fallback** (unlike phone/email) — defaulting an unset client to Tri
Star's real address would misrepresent their business, not just look
unstyled; the span simply doesn't render if `address` is absent.
Client-branch action still needed: `client/surkut`'s
`landing-page.config.json` needs its own `store.address` object added before
this actually shows Surkut's address instead of nothing.

---

### Component library session — Phase 3 (2026-07-19)

**Branch:** `feat/component-library-phase3` (off `feat/ui-pipeline-phase2`, unmerged). Spec: `docs/superpowers/specs/2026-07-19-phase3-component-library-design.md`.

**Built + tested (automated):**
- 3 placeholder blocks (`navbar`, `footer`, `menu`) restyled to production
  theme tokens; `menu`'s dark-theme contrast bug fixed as part of the same pass.
- `ScrollReveal` — shared fade-up-on-scroll wrapper (respects
  `prefers-reduced-motion`), applied to `bento-grid`, `split-image-text`, and
  `showcase-gallery`.
- `showcase-gallery` — new opt-in `zoomable` prop: Layer 1 (tap/click →
  full-screen, `Escape`/close-button/outside-click to dismiss, clicking the
  enlarged image itself does not close it) is fully E2E-covered.
- `scroll-expand-hero` — new opt-in `chapters` prop for a pinned, multi-stage
  scroll narrative. Default (no `chapters`) behaviour E2E-verified unchanged,
  including against the real Tri Star homepage's existing hero usage.
- `docs/component-library.md` + `docs/component-library-gallery.html` updated
  in step with every change above. `docs/component-sourcing-process.md`
  written — growing the library ahead of demand is no longer ad-hoc.

**Built, NOT automatically tested:**
- `PinchZoomImage` (Layer 2 of the zoomable gallery) — real two-finger
  pinch-to-zoom + drag-to-pan. Playwright cannot simulate true multi-touch;
  desktop wheel-zoom *is* covered automatically. Code review caught and fixed
  a real state-machine bug (asymmetric two-finger release silently killed
  the surviving finger's pan) via direct code tracing, plus a fragile
  clamp-measurement basis and an inert `prefers-reduced-motion` handler —
  all fixed and re-verified. **Manual pass (Chrome DevTools touch emulation,
  checklist in the Task 7 plan) status: still needed** — no subagent in this
  session had GUI/touch-emulation tooling to perform it; run it during the
  big test session before considering Layer 2 fully verified.

**Known follow-up (non-blocking, not part of this session's scope):**
- `showcase-gallery`'s zoom lightbox (`role="dialog"`/`aria-modal="true"`)
  has no focus trap or focus restore — keyboard/screen-reader users can Tab
  into background content while it's open. Flagged by code review as
  independent of the pinch/pan work and not addressed by any task in this
  plan; worth picking up before this block is wired into a real client
  config, potentially alongside any future work that touches this overlay.

**Explicitly not touched this round:** the 7 known overlapping block pairs
in `docs/component-library.md` ("known overlaps"); Tri Star's live
`landing-page.config.json`; no new registry blocks were added.

**Next:** merge order is `feat/component-library-phase3` →
`feat/ui-pipeline-phase2` → `master`, once the big manual test session
(Phase 1 + Phase 2 + this) is done.

---

## Not built — Priority 4 (medium, plan before building)

| ID | Feature | Notes |
|----|---------|-------|
| P | 2FA for admin | TOTP flow, QR setup, backup codes. Separate sprint. |
| R | Per-client git branch script | `scripts/new-client.sh` to automate `git checkout -b client-name` + seed template copy |
| S | Bulk image assignment via product CSV | Add optional `image_url` column to product import CSV; on import, create a `ProductImage` record linked to the product. Allows full product setup (including hero image) in one CSV upload without clicking through each product. |
| V | ~~Repair the Alembic migration chain~~ — **DONE** | New migration `a0b1c2d3e4f5` backfills the product-variant tables (`product_variants`, `product_option_types`, `product_option_values`, `product_variant_options`) and reshapes `cart_items`/`order_items`/`warehouse_stock` to use `variant_id`; wired in as the mergepoint immediately before `c8d9e0f1a2b3`. `alembic upgrade head` on a fresh DB now completes end-to-end and verified to produce a schema matching `create_all`. Follow-up (2026-07-07) closed the remaining drift: `alembic/env.py` was missing model imports for `reviews`, `discount_rules`, `shipping`, `addresses`, `wishlist`, `announcements` (caused autogenerate to propose spurious `DROP TABLE`s); `announcements.created_at`/`updated_at` are now `NOT NULL` in migration `d1e2f3a4b5c6` to match the model; `chat_sessions.session_key` now gets a single unique index (`ix_chat_sessions_session_key`, set unique in `d2e3f4a5b6c7`) instead of a non-unique index plus a redundant unique constraint — `e3f4a5b6c7d8` is now a no-op kept only for chain/merge-point integrity. Verified: empty `alembic revision --autogenerate` on a fresh DB, and byte-for-byte schema match (columns + indexes) between `alembic upgrade head` and `init_db.py`'s `create_all`. |
| U | Consolidate stock to one source of truth (B3) | Checkout uses only `Product.stock_quantity`; the per-variant `WarehouseStock` system is built but never wired into selling (`deduct_stock_for_variant`/`get_variant_stock_total` are unused). Decide based on need: single pool → keep product-level authoritative and retire/relabel the warehouse feature; multi-warehouse → make warehouse authoritative and derive the shop's stock. Deferred pending the multi-warehouse decision. |
| T | Eliminate frontend/backend type duplication | The frontends keep hand-written type mirrors (`frontend-starter/lib/types.ts`, `frontend-admin/lib/types.ts`) that silently drift from the backend Pydantic schemas — the cause of several 2026-07-04 bugs (`primary_image` vs `images[]`, missing `description`/`is_featured`). Fix: add an automated drift-check (CI/pre-commit runs `gen:types` and fails if `types.ts` is stale) and/or true codegen so frontend types are derived, not hand-kept; also add a `gen:types` script to the admin app (it currently has none). Process documented in `docs/type-sync.md`. |
| W | Landing-page sections wiring (Phase 2 of the 2026-07-09 theme work) | **Engineering half DONE 2026-07-16** (homepage wired to config pipeline, see "Per-client UI pipeline — Phase 1 wiring"). Remaining: the admin "Page Content" editor / DB content-layer decision — still needs its own short design session. Make the homepage render from `landing-page.config.json` (structure, superadmin) + a DB content layer (admin edits) instead of hardcoded components. Replace the current dead admin "Landing Page Sections" screen (writes to a `landing_sections` table the storefront never reads) with a "Page Content" editor: admins edit each config-defined section's text/images/CTAs and can hide/show sections, but cannot add/delete/reorder (structure stays superadmin per the role split). Pre-seed Tri Star's current content so the live site is unchanged on day one; retire the orphaned table. **Needs a design session first** (scheduling-plugin scale): per-section editable fields, image handling, overlap with announcements/promotions plugins, how config changes reach the VPS. |
| X | Composable decorative effects (glow background, shiny button) | `glowing-shadow` and `shiny-button`/`GlowButton` (`components/ui/shiny-button.tsx`, `components/blocks/visual/glowing-shadow.tsx`) only exist today as their own standalone, fixed-shape blocks — `glowing-shadow` wraps short content in one dark glow card (not usable as a page/section background), and `GlowButton` is a fixed 120×60px pill that can't be dropped into other components (e.g. swapped in for the navbar's hardcoded "Get a Quote" button, which lives in the shared `components/layout/navbar.tsx`, outside the config pipeline entirely). Surfaced 2026-07-20 during Surkut manual testing: user wanted the glow effect as a section/page background and the shiny button style applied to an existing navbar CTA — neither is possible without new code. **Needs a design session first**: decide whether these become configurable props on existing blocks (e.g. a `variant: "glow"` background option) vs. reusable style primitives other components can opt into (e.g. a `style: "shiny"` button variant), and which existing components should be able to take them. |

---

## Scheduling & Provider-Notes plugin — BACKEND BUILT (2026-07-07), frontends not built

**Design spec:** `docs/superpowers/specs/2026-07-05-scheduling-plugin-design.md`
**Impl plan:** `docs/superpowers/plans/2026-07-06-scheduling-plugin-backend.md`
**Branch:** `feat/scheduling-plugin`.

A single reusable `scheduling` plugin for appointment booking + per-client visit
journals. Shipped configured for the current **medical client** (Patient / Doctor /
Visit / SOAP clinical notes); the engine is neutral (`Client` / `Provider` /
`Appointment` / `JournalEntry`) so future verticals (salon, tutoring, rental, events)
are a config change (labels + note template + intake schema via
`GET /api/scheduling/config`), not a rebuild. This unlocks ICP profiles 5, 8, 10 (see
`gap-analysis-and-roadmap.md`).

### Built + Tested (automated) — backend
Built via subagent-driven TDD across 13 tasks; each task spec- and quality-reviewed.
**~48 scheduling tests + 1 concurrency test; full suite 296 passing.** ruff + mypy clean.
Live boot smoke confirmed: plugin appears in `/api/health` + `/api/menu`, and
`/api/scheduling/config` returns the medical labels + SOAP template.
- 8 tables + assoc + migration (`62d9c03455e5`; nullable-provider follow-up `808038705490`).
- Config/terminology + note-template registry; public `GET /config`.
- Providers, appointment-types (+ provider m2m), availability + exceptions — admin CRUD.
- Public `GET /availability` open-slot computation (recurring hours − exceptions − booked).
- Clients (patients) CRUD + customer self-record (`/clients/me`) + auto-link on booking.
- Appointment booking (admin / logged-in customer / guest) with lifecycle
  (list/get/reschedule/cancel/status transitions). **Double-booking prevented** by a
  DB `UniqueConstraint(provider_id, start_at)` + `IntegrityError`→409 (the SQLite
  `with_for_update` lock is a no-op; the constraint makes it deterministic; the row lock
  is real on Postgres). Non-admins can't book in the past or for another client.
- Booking confirmation email (non-blocking, reuses shared email util).
- Provider-scoped journals + `NoteAccessLog` audit on every read/create/edit; superadmin
  and `can_view_all_clients` overrides; `GET /audit` (superadmin only).

### Built, NOT manually tested — frontends (tsc clean, need a browser session)
Built 2026-07-07; each task tsc + eslint clean. Need manual browser verification in a test
session (no automated E2E written for these yet).
- **Admin** (`frontend-admin`, under `app/(dashboard)/scheduling/`): Providers, Appointment
  Types, Availability (recurring hours + date exceptions) CRUD; Appointments management
  (filters, create, reschedule, cancel, status) + a week-agenda **Calendar** landing page;
  **Clients (Patients)** list + per-client **hub** (demographics + intake fields, appointment
  history, and a template-driven **SOAP journal** editor that degrades to a muted "no access"
  notice on a 403). `"calendar"` added to `ICON_MAP`; TS types in `lib/types.ts`.
- **Storefront** (`frontend-starter`): public self-service **booking wizard** at `/book`
  (Service → Provider → Date/slot → Details → Confirm; guest or logged-in; labels from
  `/api/scheduling/config`; plugin-gated navbar link); **My Appointments** at
  `/account/appointments` (upcoming/past, cancel, reschedule via slot picker).
- **Backend addition for the storefront:** public read endpoints
  `GET /api/scheduling/public/appointment-types` and `/public/providers?appointment_type_id=`
  (active-only) so the booking flow can populate its pickers.

### Fast-follow — DONE (2026-07-07)
- ~~Loader-strategy perf~~ — **Done.** `Client.appointments`/`journal_entries` dropped to
  lazy-default (no code accessed them lazily); ends the list-appointments history cascade.
- ~~Superadmin journal-create test~~ — **Done.** `test_superadmin_creates_journal` added.
- ~~Status-agnostic slot uniqueness~~ — **Done.** Replaced with a **partial unique index**
  `WHERE status != 'cancelled'`, so a cancelled slot can be re-booked while two active
  bookings for the same slot still conflict. `test_can_rebook_cancelled_slot` covers it.

**Backend totals:** ~51 scheduling tests + 1 concurrency test; full suite **300 passing**.

**Deferred (post-v1, per spec):** online payment at booking; scheduled email/SMS
reminders (Celery, v1.1); DB-defined custom note templates + per-vertical setup wizard;
group/class bookings and room/equipment resource scheduling.

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

## Tech debt — needs a focused session

### Storefront lint debt (2026-07-18)

`frontend-starter` had a **pre-existing** red `npm run lint` on master (17 errors,
31 warnings) — surfaced when Phase 2 of the UI pipeline began. A low-risk pass
(branch `fix/storefront-lint`) made lint **green** (0 errors) so Phase 2 could
build on a meaningful gate, but three things were **deliberately deferred** to a
dedicated session:

- **7 `react-hooks/set-state-in-effect` sites are suppressed, not fixed.** These
  are correct, intentional patterns (mount-time `localStorage`/API reads, guard
  resets, an async loader on mount), several in **untested** flows (checkout,
  account settings, cookie-consent, analytics, loyalty widget, product-detail
  variant image, wishlist). Each has an inline `// eslint-disable-next-line
  react-hooks/set-state-in-effect -- … backlog "Storefront lint debt"`. Proper
  fix = refactor to derive-during-render / `useSyncExternalStore` / restructured
  guards, then remove the suppressions — needs a careful golden-path re-test.
- **17 `@next/next/no-img-element` warnings left as-is.** Deliberate use of
  `<img>` for dynamic backend/product image URLs. Decide: convert to
  `next/image` (needs sizing + image-domain config, risks Tri Star layout) vs.
  formally disable the rule as an accepted project choice.
- **2 `react-hooks/exhaustive-deps` warnings** (`app/account/settings/page.tsx`,
  `app/products/[slug]/product-detail-client.tsx`) — adding deps can cause
  render loops, so each needs individual judgement.

Also noted while in the files (not fixed): `app/products/[slug]/reviews.tsx`
never updates its `reviews` list in-place after a submit (no state setter used) —
possible latent UX gap.

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
- **Product barcode + multi-image** — **Built and tested (API)** — `barcode` field added end-to-end (DB, migration, schemas, CSV import/export with injection guard, both admin forms). Admin create page now has full multi-image panel. Storefront card uses `is_primary` image as thumbnail. 15 API tests pass. Browser UI still needs manual verification.
- **Product CSV image columns** — **Built and tested (API)** — `image_url_1`–`image_url_5` columns in product CSV import and export. `image_url_1` = primary. Any column filled → full image replacement; all blank → existing images untouched. 24 API tests pass (7 scenarios). Also fixed pre-existing `await db.delete()` bug in service.py.
- **WCAG contrast validation** — no automated check that brand colours meet WCAG AA; manual check required
- **Font via next/font/google** — config `"brand.font"` injects a runtime Google Fonts link tag (works); for peak performance also update the `next/font/google` import in `layout.tsx` and rebuild

### Developer experience
- **CI/CD pipeline** — out of scope until product is ready for market
- **`ENABLED_PLUGINS` / config divergence** — frontend reads config `"plugins"` list; backend reads `.env`; if they diverge, a block appears but its API returns 404 (handled gracefully)
- **Visual preview tool** — live preview of `landing-page.config.json` without running full dev stack
- ~~**Component library builder** — systematic process for sourcing new block components; currently ad-hoc~~ — done: see `docs/component-sourcing-process.md` (Phase 3, 2026-07-19)
