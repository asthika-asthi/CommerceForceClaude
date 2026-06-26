# CommerceForce — Live Backlog

Last updated: 2026-06-26. This is the single source of truth for build status.

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

---

## Built, not tested

Everything from Sprint 4 onwards is committed but untested. Test all of these in one session.

| Area | What to test |
|------|-------------|
| Analytics charts | Dashboard `/analytics` page — revenue chart, order volume, top products |
| Media manager | Upload image, copy URL, delete file |
| Order tracking | Admin enters tracking number on order → customer sees it on storefront |
| Product duplicate finder | Duplicate detection banner on product list |
| Shipping plugin | `GET /api/shipping/methods`, create/update/delete method, select at checkout |
| SEO meta tags | OG tags appear in `<head>` on product and category pages |
| GDPR consent banner | Shows on first visit, dismissed on accept, not shown again |
| Rate limiting | 429 returned after exceeding limit on login endpoint |
| Stripe refund | Admin cancels a paid Stripe order → refund appears in Stripe dashboard |
| Branding — image upload | Upload logo image via branding panel, URL appears in store |
| RFQ plugin | Customer submits quote request → admin sees it in RFQ list |
| Credit plugin | Create credit account, place order using credit limit, cancel order → credit restored |
| Inventory | Create warehouse, set stock, adjust stock, low-stock threshold alert |
| Wishlist | Customer adds product to wishlist, views wishlist, removes item |
| Reviews | Customer submits review, admin approves, shows on product page |
| Discount rules | Create automatic discount rule, add qualifying product to cart → discount applied |
| Loyalty | Customer earns points on order, admin views balance, cancel order → points reversed |
| Newsletter | Customer subscribes on storefront, admin views subscribers, exports CSV |
| Addresses | Customer saves delivery address, selects at checkout |
| Coupons — homepage | Toggle `show_on_homepage` → only one coupon shown at a time (server enforces) |
| Coupons — DELETE | Admin deletes coupon via button in admin panel |
| Credit — DELETE | Admin deletes credit account via trash icon |
| Inventory — DELETE | Admin deletes non-default warehouse (default warehouse shows no Delete button) |
| Orders — admin cancel | Admin changes order status to Cancelled → credit restored + loyalty reversed |
| Backup cron | `docker compose logs backup` shows daily backup entry at 02:00 UTC |
| AI chat | Customer sends message on storefront → response from OpenRouter (requires OPENROUTER_API_KEY set) |
| CSV export — orders | Download orders CSV from admin panel |
| CSV export — products | Download products CSV |
| CSV export — newsletter | `GET /api/newsletter/subscribers/export/csv` (admin only) |
| Reviews — author UPDATE | `PATCH /api/reviews/{id}` — author edits their own review; re-queues for approval |
| Newsletter — admin DELETE/UPDATE | Admin deletes or corrects a subscriber record |
| Discount rule — GET single | `GET /api/discount-rules/{rule_id}` |
| Loyalty — admin accounts view | `GET /api/loyalty/accounts` — admin sees all customer loyalty balances |

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
