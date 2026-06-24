# CommerceForce — Comprehensive Gap Audit & Commercial Readiness Plan

## Context

The user is in a repetitive iteration cycle: gaps are discovered one at a time during development or client demo, fixed reactively, and then new gaps appear. The goal of this plan is to break that cycle by doing a single comprehensive audit now, capturing every known gap into prioritised tiers, and executing them as deliberate sprints rather than reactive patches.

Two exploration agents and a full read of the codebase, docs, plugin list, admin panel, backlog, and deployment guide produced the findings below.

**Scope:** Commercial readiness (can we deliver a paying client right now?) + recurring agency bugs.

---

## Finding: CSV Import task is already done

The old plan file referenced CSV category import/export as a pending task. It is already shipped:
- `743d28c` — Enterprise category management: CSV import/export + auto-create
- `b41e167` — Add reusable CSV import templates for categories and products
- `85ba1d2` — Automated tests for CSV features

No action required.

---

## Recommended Approach

**Systematic sprint execution by tier** — fix Tier 1 before touching Tier 2, Tier 2 before Tier 3, etc. This is the only way out of the reactive loop. Each tier is a self-contained sprint with a clear "done" definition.

---

## Tier 1 — Blocking: must fix before first live client

These gaps mean the platform cannot be commercially delivered today, regardless of features.

### 1A. HTTPS + nginx reverse proxy + custom domain support

**Status:** Completely absent. `docker-compose.yml` exposes raw HTTP on ports 8000/3000/3001. No nginx service, no SSL config, no domain routing.

**Why blocking:**
- Stripe's JavaScript SDK (`stripe.js`) refuses to load on non-HTTPS pages — card payments silently fail
- Stripe webhook signature verification requires HTTPS endpoint — payment confirmation never arrives
- No reputable client will deploy a store on `http://123.45.67.89:3000`
- Admin passwords transmitted in plaintext over HTTP

**What to build:**
- Add `nginx` service to `docker-compose.yml` as the single external entry point
- Nginx routes: `store.clientdomain.com` → frontend-starter:3000, `admin.clientdomain.com` → frontend-admin:3001, `/api/` → backend:8000
- Certbot + Let's Encrypt integration for automatic SSL certificate generation and renewal
- Wildcard subdomain support: `*.commerceforce.agency` (agency-managed) OR custom client domain (CNAME pointing to VPS)
- Update `CORS_ORIGINS` and `NEXT_PUBLIC_API_URL` to use domain instead of IP:port
- Document in `docs/new-client-setup.md`: DNS setup, certbot commands, renewal cron

**Files to change:**
- `docker-compose.yml` — add nginx + certbot services, remove direct port exposure
- `nginx/default.conf` — new file: upstream config + SSL + HTTP→HTTPS redirect
- `docs/new-client-setup.md` — Section 1 update: domain/DNS steps before deployment

---

### 1B. Automated daily database backup

**Status:** Completely absent. SQLite lives in a Docker volume with no backup strategy. Total data loss if volume is deleted, VPS dies, or Docker daemon corrupts the file.

**What to build:**
- Bash script `scripts/backup.sh`: copies SQLite file to timestamped `backups/YYYY-MM-DD.db`, keeps last 30 days, optionally rsyncs to a remote location
- Add to `docker-compose.yml` or system cron: run `backup.sh` at 02:00 UTC daily
- Document restoration procedure in `docs/new-client-setup.md`

**Files to change:**
- `scripts/backup.sh` — new file
- `docker-compose.yml` — cron service or volume mount for backups
- `docs/new-client-setup.md` — Section 11: backup and recovery

---

### 1C. Admin new-order email notification

**Status:** Absent. `backend/app/plugins/checkout/service.py` sends order confirmation to the customer only. Admin has no way to know an order was placed except by checking the dashboard.

**What to build:**
- In `checkout/service.py`, after the customer confirmation email, send a second email to `settings.CONTACT_EMAIL` (or configurable `admin_notification_email` in BrandingConfig)
- Template: order number, customer name, total, items summary, link to admin panel order detail
- Reuse the existing `send_email()` in `backend/app/shared/email.py`

**Files to change:**
- `backend/app/plugins/checkout/service.py` — add admin notification call after `send_email(recipient, ...)`
- `backend/app/plugins/branding/models.py` + `schemas.py` — optionally add `admin_email` field (or use `CONTACT_EMAIL`)

---

### 1D. Product CSV re-import deduplication (idempotent imports)

**Status:** Every CSV import creates new records. Re-importing the same file doubles the catalogue. This was documented as a known gap in `docs/backlog.md`.

**What to build:**
- In `backend/app/plugins/products/service.py` `import_from_csv()`: before creating, query for an existing product with the same `name` (case-insensitive)
- If found → update the existing record (price, description, stock, category, etc.)
- If not found → create new
- Return updated counts: `{ created: N, updated: N, skipped: N, errors: [...] }`

**Files to change:**
- `backend/app/plugins/products/service.py` — `import_from_csv()` function

---

## Tier 2 — High priority: significant client-facing gaps

These gaps mean deployed clients will quickly notice missing functionality.

### 2A. Shipping cost configuration

**Status:** Completely absent. Checkout collects an address but no shipping fee is ever calculated or charged. The Order model has no `shipping_cost` field.

**What to build:**
- Simple flat-rate and weight-based shipping config in admin (no carrier API needed yet)
- `shipping_zones` table: zone name, countries, rate (flat or per-kg)
- Checkout: look up zone from delivery country, add `shipping_cost` line to order summary
- Admin: Shipping settings page to configure zones and rates

**Files to change:**
- `backend/app/plugins/checkout/` — new models, service logic
- `backend/app/plugins/orders/models.py` — add `shipping_cost` field
- `frontend-starter/app/checkout/page.tsx` — show shipping cost line
- `frontend-admin/app/(dashboard)/settings/` — add shipping config UI

---

### 2B. sitemap.xml + robots.txt

**Status:** Completely absent. Both are required for Google to correctly index the storefront.

**What to build:**
- `frontend-starter/app/sitemap.ts` — Next.js dynamic sitemap: fetch all active products and categories, generate URLs
- `frontend-starter/public/robots.txt` — allow Googlebot on storefront, disallow admin panel paths
- `frontend-admin/public/robots.txt` — disallow all (admin panel should not be indexed)

**Files to change:**
- `frontend-starter/app/sitemap.ts` — new file
- `frontend-starter/public/robots.txt` — new file
- `frontend-admin/public/robots.txt` — new file

---

### 2C. GDPR cookie consent banner

**Status:** Completely absent. Required by UK PECR and EU ePrivacy Directive for any site using cookies (auth tokens, guest cart, analytics). Non-compliance is a regulatory risk for UK/EU clients.

**What to build:**
- Minimal consent component: "This site uses cookies for your shopping cart and session. [Accept] [Decline]"
- Store consent in `localStorage` (not a cookie — avoids the circular problem)
- On decline: don't set the guest cart cookie; don't load any third-party scripts
- No cookie analytics platform needed yet — just the banner + consent state

**Files to change:**
- `frontend-starter/components/cookie-consent.tsx` — new file
- `frontend-starter/app/layout.tsx` — render `<CookieConsent />` conditionally

---

### 2D. Auth rate limiting

**Status:** Absent. `/api/auth/login` and `/api/auth/register` have no protection against brute-force or credential-stuffing attacks.

**What to build:**
- Add `slowapi` (FastAPI rate-limiting library) to `backend/pyproject.toml`
- Apply `@limiter.limit("5/minute")` to `POST /auth/login`
- Apply `@limiter.limit("3/minute")` to `POST /auth/register`
- Return HTTP 429 with `Retry-After` header when exceeded

**Files to change:**
- `backend/pyproject.toml` — add `slowapi`
- `backend/app/main.py` — init `Limiter`, attach to app state
- `backend/app/plugins/auth/router.py` — add `@limiter.limit()` decorators

---

### 2E. Logo/image upload in admin branding panel

**Status:** Text URL input only. Admins cannot upload a logo or hero image directly — must use external image hosting (Cloudinary, Google Drive, etc.). This is a major friction point for non-technical clients.

**What to build:**
- Reuse the existing `POST /api/products/upload-image` endpoint (already exists in products plugin)
- In `frontend-admin/app/(dashboard)/branding/page.tsx`: replace `logo_url` text input with a file picker that uploads to `/api/products/upload-image` and fills the URL field with the returned path
- Same for favicon, hero image

**Files to change:**
- `frontend-admin/app/(dashboard)/branding/page.tsx` — add upload widget for logo, favicon

---

### 2F. Stripe refund / order cancellation flow

**Status:** Admin can set order status to "cancelled" but no Stripe refund is triggered. Money stays with the merchant and customer never gets refunded automatically.

**What to build:**
- In `backend/app/plugins/orders/service.py`: when status changes to `cancelled` and `order.payment_method == "stripe"` and `order.stripe_payment_intent_id` exists → call `stripe.Refund.create(payment_intent=...)` 
- Admin panel: show refund confirmation dialog before cancelling a paid Stripe order
- Handle partial refunds later (not in scope now — just full refund on cancel)

**Files to change:**
- `backend/app/plugins/orders/service.py` — add refund call in status update
- `frontend-admin/app/(dashboard)/orders/[id]/page.tsx` — add confirmation dialog

---

### 2G. Open Graph / social sharing meta tags

**Status:** Product detail has `generateMetadata()` (title + description) but no Open Graph tags. Sharing a product on Facebook/WhatsApp/Slack shows no image, no formatted title.

**What to build:**
- In `frontend-starter/app/products/[slug]/page.tsx` `generateMetadata()`: add `openGraph` object with `title`, `description`, `images: [product.images[0]]`, `type: "product"`
- Same for category pages in `frontend-starter/app/products/page.tsx`

**Files to change:**
- `frontend-starter/app/products/[slug]/page.tsx` — extend `generateMetadata`
- `frontend-starter/app/products/page.tsx` — add dynamic category metadata

---

## Tier 3 — Agency operations gaps

These affect how efficiently the agency can deliver and manage multiple clients.

### 3A. Deployment automation script

**Status:** Fully manual ~2 hour process documented in `docs/new-client-setup.md`. Each new client requires: SSH, Git clone, env file creation, Docker build, Alembic migration, seed, SSL cert setup.

**What to build:**
- `scripts/deploy-client.sh`: takes `CLIENT_NAME`, `SERVER_IP`, `ADMIN_EMAIL`, `STORE_NAME` as args; SSHes to VPS, clones repo, writes `.env` files, runs `docker compose up --build -d`, runs migrations and seed, sets up certbot
- Reduces new client deployment from ~2 hours to ~15 minutes

**Files to change:**
- `scripts/deploy-client.sh` — new file

---

### 3B. Per-client seed data JSON

**Status:** `seed.py` uses a hardcoded `_products()` function with generic demo products (Electronics, Clothing, etc.) that appear on every client store. Documented in backlog as a known gap.

**What to build:**
- `backend/seed-data.json` — schema: `{ branding: {...}, categories: [...], products: [...] }`
- `seed.py` reads from `seed-data.json` if it exists, falls back to demo data otherwise
- Agency creates a `client-seed-data.json` per client as part of onboarding

**Files to change:**
- `backend/seed.py` — read from JSON file
- `backend/seed-data.json` — new example file with empty / placeholder structure

---

### 3C. Stripe publishable key as runtime config

**Status:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is a Next.js build-time env var (baked into the JS bundle). To change it per client, you must rebuild the frontend — not feasible for white-label delivery.

**What to build:**
- Move publishable key to backend branding config: store `stripe_publishable_key` in the `BrandingConfig` DB table
- Fetch it at runtime in the checkout page (server component fetches, passes to client)
- Remove `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` from env

**Files to change:**
- `backend/app/plugins/branding/models.py` + `schemas.py` — add `stripe_publishable_key` field
- `frontend-starter/app/checkout/page.tsx` — fetch key from branding API at server render time
- `frontend-admin/app/(dashboard)/branding/page.tsx` — add Stripe key field to branding form

---

## Tier 4 — Polish and compliance (important but not blocking)

| Gap | Where | Action |
|-----|-------|--------|
| Media management page | Admin panel | Browse/delete uploaded images; files accumulate indefinitely |
| Admin analytics charts | `frontend-admin/(dashboard)/dashboard/` | Revenue over time graph, top products, conversion stub |
| Product variants | New plugin | Size/colour variants per product; blocked by data model change |
| PostgreSQL migration guide | `docs/` | Guide + docker-compose change for high-traffic clients |
| 2FA for admin | Auth plugin | TOTP-based; security hardening |
| Coupon `show_on_homepage` enforcement | Backend | Server-side constraint, not just UI warning |
| Order tracking number field | Orders plugin | Admin adds carrier + tracking ref; customer sees it in order detail |

---

## Execution Order

Each tier is a sprint. Do not start the next tier until the current one is complete and tested.

```
Sprint 1 (Tier 1) → HTTPS + nginx + backup + admin email + CSV dedup
Sprint 2 (Tier 2) → Shipping + sitemap + GDPR + rate limiting + image upload + Stripe refund + OG tags
Sprint 3 (Tier 3) → Deploy script + seed JSON + Stripe runtime key
Sprint 4 (Tier 4) → Media manager + analytics charts + variants + PostgreSQL guide
```

---

## Testing Strategy

Each sprint ships automated backend tests (pytest) for all new server-side logic, plus manual E2E acceptance tests for the full flow. Frontend components are verified by running the dev server and exercising every path described below.

---

### Sprint 1 Tests

#### 1A — HTTPS + nginx

| Test | Type | Pass condition |
|------|------|----------------|
| HTTP → HTTPS redirect | Manual (curl) | `curl -I http://domain` returns `301 Location: https://domain` |
| SSL cert valid | Manual (browser) | Padlock shows; cert issued by Let's Encrypt |
| Stripe card payment end-to-end | Manual | Test card `4242 4242 4242 4242` completes; order status → `confirmed` in admin |
| Stripe webhook signature verified | Backend test | Mock webhook with correct secret → 200; wrong secret → 400 |
| Frontend loads over HTTPS | Manual | Storefront + admin panel both load on `https://` with no mixed-content warnings |
| Edge: cert renewal (dry run) | Manual | `certbot renew --dry-run` exits 0 |

#### 1B — Daily backup

| Test | Type | Pass condition |
|------|------|----------------|
| Backup creates timestamped file | Bash test | Run `backup.sh`; file `backups/YYYY-MM-DD.db` exists |
| Backup is a valid SQLite file | Bash test | `sqlite3 backups/YYYY-MM-DD.db "SELECT COUNT(*) FROM users"` returns a number |
| Old backups pruned at 30 days | Bash test | Seed 31 dummy files → after run, only 30 remain |
| Edge: backup runs when DB is locked | Bash test | Simulate concurrent write; backup uses SQLite `.backup` API (safe for live DB) |
| Restoration from backup | Manual | Replace production DB with backup file; site loads with correct data |

#### 1C — Admin new-order email notification

```python
# backend/tests/test_admin_order_email.py  (new)
async def test_admin_email_sent_on_order(client, db, mocker):
    send_mock = mocker.patch("app.shared.email.send_email", new_callable=AsyncMock)
    # place order as guest
    await client.post("/api/checkout", json={...})
    calls = [str(c) for c in send_mock.call_args_list]
    assert any("admin@" in c or CONTACT_EMAIL in c for c in calls), "Admin notification not sent"
    assert any("customer@" in c for c in calls), "Customer confirmation not sent"

async def test_admin_email_not_blocking_when_smtp_fails(client, db, mocker):
    mocker.patch("app.shared.email.send_email", side_effect=Exception("SMTP timeout"))
    # Order must still complete even when email fails
    resp = await client.post("/api/checkout", json={...})
    assert resp.status_code == 201
```

Edge cases:
- SMTP fails → order completes; error logged; no 500 returned to customer
- `CONTACT_EMAIL` not configured in branding → skip admin email silently
- Guest checkout (no account) → customer email sent to `guest_email` field

#### 1D — CSV deduplication

```python
# backend/tests/test_csv_dedup.py  (extends existing test_csv_features.py)
async def test_reimport_updates_not_duplicates(client, db, admin_token):
    csv1 = "name,price\nWidget A,9.99\n"
    await import_csv(client, admin_token, csv1)
    await import_csv(client, admin_token, csv1)  # same file again
    products = await client.get("/api/products")
    names = [p["name"] for p in products.json()["items"]]
    assert names.count("Widget A") == 1, "Duplicate created on re-import"

async def test_reimport_updates_price(client, db, admin_token):
    await import_csv(client, admin_token, "name,price\nWidget A,9.99\n")
    await import_csv(client, admin_token, "name,price\nWidget A,14.99\n")
    products = await client.get("/api/products")
    widget = next(p for p in products.json()["items"] if p["name"] == "Widget A")
    assert float(widget["price"]) == 14.99

async def test_case_insensitive_dedup(client, db, admin_token):
    await import_csv(client, admin_token, "name,price\nWidget A,9.99\n")
    await import_csv(client, admin_token, "name,price\nwidget a,9.99\n")
    products = await client.get("/api/products")
    assert len([p for p in products.json()["items"] if "widget" in p["name"].lower()]) == 1
```

---

### Sprint 2 Tests

#### 2A — Shipping costs

```python
# backend/tests/test_shipping.py  (new)
async def test_uk_flat_rate_applied(client, db, admin_token):
    # configure GB zone at £4.99 flat
    await create_shipping_zone(client, admin_token, countries=["GB"], flat_rate=4.99)
    summary = await checkout(client, delivery_country="GB")
    assert float(summary["shipping_cost"]) == 4.99

async def test_international_zone_applied(client, db, admin_token):
    await create_shipping_zone(client, admin_token, countries=["US"], flat_rate=12.99)
    summary = await checkout(client, delivery_country="US")
    assert float(summary["shipping_cost"]) == 12.99

async def test_no_zone_configured_defaults_to_zero(client, db, admin_token):
    # no zones configured
    summary = await checkout(client, delivery_country="AU")
    assert float(summary["shipping_cost"]) == 0.00
```

Edge cases:
- Country with no matching zone → £0.00 shipping (not an error)
- Weight-based: product with 0 weight → £0.00 shipping fee
- Coupon discount applies to subtotal BEFORE shipping (not to shipping)
- Loyalty points redemption does not reduce shipping cost

#### 2B — sitemap.xml

| Test | Type | Pass condition |
|------|------|----------------|
| Sitemap returns 200 | Manual (browser) | `GET /sitemap.xml` responds with XML |
| Contains product URLs | Manual | `<loc>https://domain/products/product-slug</loc>` present for every active product |
| Contains category URLs | Manual | `<loc>https://domain/products?category=cat-slug</loc>` present |
| Inactive products excluded | Manual | Set a product `is_active=false`; not in sitemap |
| Google Search Console | Manual (post-deploy) | Submit sitemap URL; no errors reported |

#### 2C — GDPR cookie consent

| Test | Type | Pass condition |
|------|------|----------------|
| Banner appears on first visit | Manual | Fresh incognito window → banner visible |
| Accept sets preference | Manual | Click Accept → banner dismissed; preference in `localStorage` |
| Decline suppresses guest cart cookie | Manual | Click Decline → add item to cart → no `guest_session` cookie in devtools |
| Returning visitor no re-prompt | Manual | Refresh page → no banner if preference already stored |
| Edge: localStorage blocked | Manual | Block localStorage in browser → banner shows on every page (graceful degradation) |

#### 2D — Auth rate limiting

```python
# backend/tests/test_rate_limiting.py  (new)
async def test_login_rate_limit_triggers_at_6th_attempt(client):
    for _ in range(5):
        await client.post("/api/auth/login", json={"email": "x@x.com", "password": "wrong"})
    resp = await client.post("/api/auth/login", json={"email": "x@x.com", "password": "wrong"})
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers

async def test_different_ip_not_affected(client):
    # 5 attempts from IP A
    for _ in range(5):
        await client.post("/api/auth/login", ..., headers={"X-Forwarded-For": "1.2.3.4"})
    # 1 attempt from IP B — should still succeed (wrong password = 401, not 429)
    resp = await client.post("/api/auth/login", ..., headers={"X-Forwarded-For": "5.6.7.8"})
    assert resp.status_code == 401  # wrong password, not rate-limited

async def test_successful_login_resets_counter(client, db):
    # This is implementation-dependent; document behaviour either way
    pass
```

#### 2F — Stripe refund on cancellation

```python
# backend/tests/test_stripe_refund.py  (new)
async def test_cancel_stripe_order_triggers_refund(client, db, admin_token, mocker):
    stripe_mock = mocker.patch("stripe.Refund.create")
    order = await create_paid_stripe_order(db, payment_intent_id="pi_test_123")
    await client.patch(f"/api/orders/{order.id}/status",
                       json={"status": "cancelled"}, headers=admin_token)
    stripe_mock.assert_called_once_with(payment_intent="pi_test_123")

async def test_cancel_cash_order_no_refund_call(client, db, admin_token, mocker):
    stripe_mock = mocker.patch("stripe.Refund.create")
    order = await create_paid_cash_order(db)
    await client.patch(f"/api/orders/{order.id}/status",
                       json={"status": "cancelled"}, headers=admin_token)
    stripe_mock.assert_not_called()

async def test_stripe_refund_failure_does_not_block_cancellation(client, db, admin_token, mocker):
    mocker.patch("stripe.Refund.create", side_effect=Exception("Stripe error"))
    order = await create_paid_stripe_order(db)
    resp = await client.patch(f"/api/orders/{order.id}/status",
                               json={"status": "cancelled"}, headers=admin_token)
    assert resp.status_code == 200  # cancellation still works; error logged
    # Manual refund warning should appear in response body
    assert "manual" in resp.json().get("warning", "").lower()
```

---

### Sprint 3 Tests

#### 3A — Deployment script

| Test | Type | Pass condition |
|------|------|----------------|
| Script runs to completion | Bash (dry-run mode) | Add `--dry-run` flag; prints all commands without executing |
| `.env` generated correctly | Bash test | Check generated file has all required keys |
| Idempotent: re-running on existing deployment | Manual | Running script twice on same VPS doesn't break the store |
| Edge: invalid SERVER_IP | Bash test | Script exits with clear error, not SSH timeout |

#### 3C — Stripe key as runtime config

```python
async def test_checkout_uses_branding_stripe_key(client, db, mocker):
    await set_branding(db, stripe_publishable_key="pk_test_newkey")
    # Checkout page (server render) should return the key in its initial props
    resp = await client.get("/checkout")  # or check the API
    assert "pk_test_newkey" in resp.text

async def test_checkout_works_without_stripe_key_configured(client, db):
    # Stripe key not set → card payment option hidden, not a crash
    await set_branding(db, stripe_publishable_key=None)
    resp = await client.get("/api/checkout/payment-methods")
    methods = [m["key"] for m in resp.json()]
    assert "stripe" not in methods
```

---

## Execution Order

Each tier is a sprint. Do not start the next tier until the current one is complete and all tests pass.

```
Sprint 1 (Tier 1) → HTTPS + nginx + backup + admin email + CSV dedup
Sprint 2 (Tier 2) → Shipping + sitemap + GDPR + rate limiting + image upload + Stripe refund + OG tags
Sprint 3 (Tier 3) → Deploy script + seed JSON + Stripe runtime key
Sprint 4 (Tier 4) → Media manager + analytics charts + variants + PostgreSQL guide
```

**Sprint gate:** Before moving to the next sprint, run `python -m pytest -q` and all new tests must pass. Any failing test blocks the next sprint from starting.

---

## Acceptance Verification (end of each sprint — full E2E walkthrough)

**Sprint 1 done when:**
- `https://store.testdomain.com` loads; HTTP redirects to HTTPS; padlock shows
- Stripe card `4242...` completes; webhook confirmed; order status = `confirmed`
- `backup.sh` produces `backups/YYYY-MM-DD.db`; file is a valid SQLite DB
- Test order sends email to customer AND admin contact email
- Importing the same products CSV twice leaves only 1 copy of each product

**Sprint 2 done when:**
- Checkout shows non-zero shipping cost for a UK delivery address
- `/sitemap.xml` lists all active products and categories
- Cookie consent banner appears; decline suppresses the cart cookie
- 6 rapid logins return HTTP 429 with `Retry-After` header
- Logo uploads from branding panel without needing an external URL
- Cancelling a paid Stripe order appears as a refund in Stripe dashboard
- Sharing a product link on Slack shows product image + name preview

**Sprint 3 done when:**
- `deploy-client.sh` runs to completion in under 20 minutes on a fresh VPS
- Setting a different Stripe publishable key in branding panel reflects immediately in checkout (no rebuild)

**Sprint 4 done when:**
- Admin can browse and delete uploaded images from the media panel
- Admin dashboard shows a 30-day revenue chart
