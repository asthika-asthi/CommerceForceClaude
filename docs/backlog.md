# CommerceForce — Live Backlog

Last updated: 2026-06-27. This is the single source of truth for build status.

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

---

---

## Not built — Priority 4 (medium, plan before building)

| ID | Feature | Notes |
|----|---------|-------|
| P | 2FA for admin | TOTP flow, QR setup, backup codes. Separate sprint. |
| Q | Storefront component library | New visual block components (glowing buttons, glassmorphism, parallax) must be React components registered in `block-registry.ts` before config can reference them. Includes polished variant picker UI (swatches, visual size grid). |
| R | Per-client git branch script | `scripts/new-client.sh` to automate `git checkout -b client-name` + seed template copy |

---

## Not built — Product variants v2 (deferred from spec)

These items were explicitly out of scope for Product variants v1. Build after v1 is tested.

| Feature | Notes |
|---------|-------|
| Per-variant pricing | Allow XL or premium finishes to cost more than base price. Requires adding `price_override` to `product_variants` and updating cart/checkout price resolution. |
| Polished storefront variant picker | Colour swatches, visual size grid, strikethrough for out-of-stock. Blocked on component library (Q). |
| Variant images | Show colour-specific images when a colour variant is selected. Requires linking `ProductImage` to a variant. |
| Bulk variant import via CSV | Admin uploads a CSV with all variant SKUs and option values. Separate sprint. |
| Warehouse-to-warehouse stock transfers at variant level | Inventory v2. |

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
- **Image management** — no admin UI to browse or delete uploaded files; `/uploads/` accumulates indefinitely
- **WCAG contrast validation** — no automated check that brand colours meet WCAG AA; manual check required
- **Font via next/font/google** — config `"brand.font"` injects a runtime Google Fonts link tag (works); for peak performance also update the `next/font/google` import in `layout.tsx` and rebuild

### Developer experience
- **CI/CD pipeline** — out of scope until product is ready for market
- **`ENABLED_PLUGINS` / config divergence** — frontend reads config `"plugins"` list; backend reads `.env`; if they diverge, a block appears but its API returns 404 (handled gracefully)
- **Visual preview tool** — live preview of `landing-page.config.json` without running full dev stack
- **Component library builder** — systematic process for sourcing new block components; currently ad-hoc
