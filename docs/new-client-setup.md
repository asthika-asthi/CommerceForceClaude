# CommerceForce — New Client Setup Guide

This is the complete guide for delivering a CommerceForce store to a new client.
Follow every section in order. Do not skip steps.

---

## Overview of the full process

1. Server provisioning and firewall
2. Clone and configure environment files
3. Build and start the application
4. Create database tables and seed accounts (includes client first login)
5. Branding and visual identity
6. Plugin selection (which features to enable)
7. Categories and product catalog (CSV import)
8. Landing page setup
9. Hand off to client
10. Backups and recovery
11. HTTPS + nginx + custom domain

Section numbers below match this list exactly (1–11). Payment setup (Stripe)
is inside the Go-Live Checklist just below, since it's deployment-time
configuration rather than a one-time setup step.

---

## Go-Live Checklist

Read this first. These are the items that gate whether a client's store can go
live in production — pulled together from across this guide, `docs/bugs-log.md`,
and `docs/gap-analysis-and-roadmap.md` so you don't have to hunt across three
files before every launch. Everything here is deployment-time configuration —
no code changes needed.

### Blocking — must complete before the client's site goes live

- [ ] **HTTPS certificate issued and nginx enabled** — Section 11. Needs the
      client's domain pointed at your VPS via DNS first.
- [ ] **Stripe live keys set** — `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
      in `backend/.env` (see *Payment setup* below). Cash and store-credit
      checkout work without this; only card payments are gated.
- [ ] **SMTP configured** with a real mailbox or transactional service (Brevo/Resend
      recommended — many VPS providers block outbound port 587) — Section 2.2
      gotcha, Section 4.3. Without this, password resets still work via the
      server-log fallback, but that's not something to leave a live client on.
- [ ] **`SECRET_KEY` generated fresh** for this deployment via
      `scripts/generate-env.sh` — never reuse the repo's dev key — Section 2.2.
- [ ] **Default admin password changed** from the `seed.py` default
      (`admin@commerceforce.dev / Admin1234!`) — Section 4.3.
- [ ] **`CORS_ORIGINS` / `STOREFRONT_URL` / `ADMIN_URL`** point at the client's
      real domain, not the `testshop.com` template values — Section 2.2, 11.6.
- [ ] **`COOKIE_SECURE=true`** once HTTPS is live (only `false` during
      HTTP-only testing) — Section 11 gotcha.

### Payment setup — Stripe

Card payments need **two separate keys in two separate places** — missing the
second one is the single most common reason "Pay by Card" never appears on
the storefront even though the client swears they "configured Stripe":

1. In the client's Stripe dashboard, get the live **Secret Key** (`sk_live_...`).
2. Set `STRIPE_SECRET_KEY` in `backend/.env`. This key alone is *not* enough —
   it only lets the backend create/confirm payments; it does not make the
   card option appear.
3. Register a webhook endpoint for the `payment_intent.succeeded` event
   pointing at the live backend URL; copy the signing secret into
   `STRIPE_WEBHOOK_SECRET` in `backend/.env`.
4. `docker compose restart backend`
5. **Also set the live Publishable Key (`pk_live_...`)** — but *not* in
   `.env`. Log in to the admin panel → **Branding** → **Stripe Publishable
   Key** field → paste it there → **Save Branding**. The storefront reads
   this from the branding API at runtime (not from a build-time env var),
   specifically so each client's key can differ without rebuilding the
   frontend. Skip this step and every customer sees only "Cash on Delivery"
   (and "Trade Credit Account" for B2B customers who have one) — no card
   option, with no error anywhere to explain why.
6. Test: place a real (or Stripe test-mode) card order and confirm it shows
   as paid — check `docker compose logs backend` for the webhook firing.

**Local/dev testing without a public URL:** use the Stripe CLI to forward
webhook events to your machine — `stripe listen --forward-to
localhost:8000/api/checkout/stripe-webhook` — then put the `whsec_...` it
prints into `STRIPE_WEBHOOK_SECRET`. Use Stripe's test card `4242 4242 4242
4242` (any future expiry, any CVC).

**Trade Credit Account is not a card and needs no Stripe setup.** It's a
separate, pre-approved business credit line — see *Trade credit accounts* in
Section 6 below. The storefront only shows it to a customer an admin has
explicitly granted one to; everyone else sees Cash and Card only.

### Known open issues — not launch-blocking, but worth disclosing or tracking

- Coupon "one per customer" can be bypassed by two simultaneous checkouts
  using the same code (narrow timing window, minor revenue leak).
- A newly registered customer keeps a working session for up to 7 days before
  email verification is enforced.
- `discount_rules` service commits to the database mid-request instead of at
  the end like the rest of the app (technical debt, not a live bug).

Full detail: `docs/bugs-log.md`.

### Recommended before competing head-on with Shopify/Woo — not blocking

- **Tax/VAT calculation** — the field exists on every order but nothing
  computes it; blocks any client legally required to show VAT.
- **Analytics / GA4 / Meta Pixel injection** — no per-client way to add
  tracking yet; clients ask for this early.
- **Abandoned-cart recovery emails** — infrastructure (email + background
  jobs) already exists, just not wired up.
- **Guest order tracking page** — guests get a confirmation email but no
  "check my order status" link.
- **GDPR data export/delete** — consent banner exists; the actual
  download/delete-my-data flow doesn't.

Full detail: `docs/gap-analysis-and-roadmap.md` Part B.

### Final verification before sending credentials to the client

Section 9 has the full handoff checklist. At minimum: all three containers
running, storefront and admin load over HTTPS with a valid padlock, the
client can log in with their own password, at least one category and product
are visible, and a test order has been placed successfully (cash, and card
too if Stripe is enabled).

---

## Section 1 — Server provisioning

### 1.1 What you need
- A Linux VPS running Ubuntu 22.04 or later
- Root or sudo SSH access
- The server's public IP address

### 1.2 Install Docker and Git
```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin git
systemctl enable docker
systemctl start docker
```

### 1.3 Open firewall ports
```bash
ufw allow 22      # SSH — never close this or you'll be locked out
ufw allow 8000    # Backend API
ufw allow 3000    # Customer storefront
ufw allow 3001    # Admin panel
ufw enable
```

**Gotcha:** If you forget to open the ports, the site will appear to load (containers are running) but the browser will say "site can't be reached". Always open these ports before testing.

---

## Section 2 — Clone and configure

### 2.1 Clone the repository
```bash
cd /opt
mkdir commerceforce && cd commerceforce
git clone https://github.com/asthika-asthi/CommerceForceClaude.git
cd CommerceForceClaude
```

### 2.2 Generate both `.env` files automatically

Instead of creating the files manually, run the env generator script. It prompts you for each value, auto-generates the `SECRET_KEY`, and writes both files:

```bash
bash scripts/generate-env.sh
```

Answer the prompts (press Enter to accept the default shown in brackets). The script writes:
- `.env` — root file (just `SERVER_IP`, used by Docker Compose)
- `backend/.env` — all secrets and per-client config

> **If you don't have bash** (e.g. Windows without Git Bash), use the manual method below instead.

**Gotcha — SMTP_PASSWORD:** This must be a Gmail App Password (16 characters), not your regular Gmail password. Generate one at: Google Account → Security → 2-Step Verification → App Passwords. Even then, some VPS providers block outbound port 587. See Section 4 for the fallback.

<details>
<summary>Manual method (without bash)</summary>

Create `.env` next to `docker-compose.yml`:
```
SERVER_IP=YOUR.SERVER.IP.HERE
```

Create `backend/.env` — copy the template from `scripts/generate-env.sh` and fill in all values. Generate `SECRET_KEY` with:
```bash
openssl rand -hex 32
```

> **Running on plain HTTP (no domain/HTTPS yet)?** Add `COOKIE_SECURE=false` to `backend/.env`.
> The login refresh cookie is marked *Secure* by default (correct for HTTPS), which the browser
> **won't send over HTTP** — causing constant logouts and "new tab drops to login". Set it back
> to `COOKIE_SECURE=true` once HTTPS is enabled (Section 11).

> **Currency:** the store currency defaults to GBP (£). To use another currency, set
> `CURRENCY_CODE` in the **root** `.env` (next to `docker-compose.yml`), e.g. `CURRENCY_CODE=USD`.
> This drives the storefront/admin price symbols **and** the Stripe charge currency. Because the
> frontends bake it in at build time, **rebuild the frontends** after changing it:
> `docker compose build frontend-starter frontend-admin && docker compose up -d --force-recreate`.
> Supported: GBP £, USD $, EUR €, INR ₹, AUD A$, CAD C$, AED, SGD S$, NZD NZ$ (others show the code).

</details>

---

## Section 3 — Build and start

```bash
docker compose up --build -d
```

This builds three Docker images and starts them:
- Backend API on port 8000
- Customer storefront on port 3000
- Admin panel on port 3001

**This takes 5–10 minutes on first run.** Do not interrupt it.

After it finishes, verify all three are running:
```bash
docker compose ps
```
All three should show `running`. If any shows `restarting` or `exited`, check the logs:
```bash
docker compose logs backend
```

---

## Section 4 — Database and accounts

### 4.1 Create database tables
```bash
docker compose exec backend python init_db.py
docker compose exec backend alembic stamp head
```

This creates all the database tables from the models, then marks Alembic as up-to-date so
future migrations apply cleanly. **Must be run once on first deployment.** If you skip this,
every page on the storefront will error.

> The Alembic migration chain is fixed: `docker compose exec backend alembic upgrade head` now
> also works end-to-end on a fresh database (migration `a0b1c2d3e4f5` backfills the
> product-variant tables that used to be missing from the chain). `init_db.py` + `alembic stamp
> head` above is still the recommended path for new deployments — it's faster and avoids running
> ~18 migrations one at a time — but `alembic upgrade head` is no longer broken as a fallback.

`init_db.py` is safe to re-run — it skips tables that already exist.

### 4.2 Create accounts and branding
```bash
docker compose exec backend python seed.py
```

This creates:
- Your superadmin account (agency login)
- The client's admin account
- Initial store name, tagline, and contact email

### 4.3 Client first login

Email delivery from a VPS is unreliable. **Always retrieve the password reset link from the logs** — it is printed there regardless of whether the email is sent:

```bash
docker compose logs backend | grep "PASSWORD RESET"
```

You will see a line like:
```
[PASSWORD RESET] owner@client.com -> http://IP:3001/reset-password?token=abc123...
```

Send that URL to the client. They open it, set their own password, then log in at `http://IP:3001`.

**Gotcha — no link appears:** This means either the email wasn't found in the database or the form was never submitted. Verify by re-running the forgot-password form and then checking the log again:
```bash
docker compose logs backend | grep "PASSWORD RESET"
```

**Gotcha — SMTP error in logs:** Run `docker compose logs backend | grep "Email"` to see the SMTP error. Common cause: VPS blocks outbound port 587. Fix: use a transactional email service (Brevo or Resend) and update the `SMTP_*` values.

---

## Section 5 — Branding

Log in to the admin panel at `http://IP:3001`.

Go to **Branding** in the left sidebar. Fill in:

| Field | What it does |
|-------|-------------|
| Store Name | Appears in the browser tab and header |
| Tagline | Subtitle on the storefront homepage |
| Logo URL | URL to the client's logo image (must be hosted somewhere accessible) |
| Favicon URL | Small icon in the browser tab |
| Primary Color | Main brand colour — buttons, links, highlights |
| Secondary Color | Accent colour |
| Font Family | Typeface for the storefront (e.g. `Inter`, `Poppins`, `Georgia`) |
| Contact Email | Shown in the footer and used for contact form replies |
| Contact Phone | Shown in the footer |
| Social Links | JSON format: `{"instagram": "https://...", "facebook": "https://..."}` |
| Custom CSS | Advanced: paste CSS to override any storefront style |

Click **Save Branding** when done.

**Gotcha — Logo URL:** The logo must be hosted at a public URL. You cannot upload an image file directly in the branding panel yet. Options: upload to the client's Google Drive and get a public link, use Cloudinary (free tier), or use any image hosting service.

---

## Section 6 — Plugin selection

Plugins control which features are visible to the client in the admin panel and on the storefront. You choose which ones to enable per client by editing `ENABLED_PLUGINS` in `backend/.env`.

| Plugin name | What it enables |
|-------------|----------------|
| `auth` | Login, registration, password reset — **always required** |
| `categories` | Product categories |
| `products` | Product catalogue, CSV import/export |
| `cart` | Shopping cart |
| `orders` | Order management |
| `checkout` | Checkout flow and payment |
| `branding` | Store name, colours, logo, CSS |
| `landing_page` | Homepage section builder |
| `coupons` | Discount codes |
| `loyalty` | Points and rewards programme |
| `newsletter` | Email subscription capture |
| `ai_chat` | AI-powered customer chat widget |
| `rfq` | Request for Quote (B2B enquiries) |
| `credit` | Trade credit accounts for approved B2B customers (see below) |
| `inventory` | Multi-warehouse *location* tracking (see below) — not what limits what a customer can buy |
| `contact` | Contact form |
| `addresses` | Saved delivery addresses |
| `wishlist` | Customer wishlists |
| `reviews` | Product reviews |
| `discount_rules` | Automatic discounts (e.g. 10% off orders over £100) |
| `shipping` | Per-country flat-rate shipping costs |
| `tax` | Per-country VAT/tax rates, applied at checkout |
| `promotions` | Promotional banners |
| `announcements` | Site-wide announcement bar |

**Trade credit accounts (B2B customers):** the `credit` plugin lets an admin
grant an approved trade customer a pre-approved spending limit they can
charge orders against instead of paying immediately — a net-terms account,
not a credit card. It is **not** shown to customers by default; an admin
must set one up first via **Admin → Credit Accounts → New Account**, picking
the customer and setting their limit. Only customers with an active account
ever see "Trade Credit Account" as a payment option at checkout — regular
retail (B2C) customers, and guests, never see it. If a client doesn't do
trade/wholesale sales, leave `credit` out of `ENABLED_PLUGINS` entirely.

**Stock is set per product variant, not on a warehouse.** The `inventory`
plugin's Warehouses page tracks *where* stock physically sits across
multiple locations — it does **not** gate checkout. The number that actually
stops a customer from over-ordering is set on the product itself: **Admin →
Products → [product] → Variants tab**, per variant. For a product with
variants (e.g. sizes/colours), you must click **Generate combinations**
first — defining option values alone does not create purchasable variants —
then enter a stock number for each one. A product's total stock shown
elsewhere in the admin is automatically the sum of its variants' stock; it
becomes read-only once real variants exist. A product with no variants keeps
a single, directly-editable stock field as before.

**To change enabled plugins:**
1. Edit `backend/.env` on the server — update the `ENABLED_PLUGINS` line
2. Run `docker compose restart backend` (no rebuild needed)

**Gotcha:** Removing a plugin hides its admin menu but does not delete its data. Re-enabling it restores full access to the data.

---

## Section 7 — Categories and products (CSV import)

You have two options depending on how much data you have:

---

### Option A — Small catalog: create categories manually, import products

**Step 7a — Create categories in the admin panel**
1. In the admin panel, click **Categories**
2. Type the category name (e.g. `Tarpaulins`) and click **Create Category**
3. For subcategories, select the parent in the **Parent Category** dropdown
4. Repeat for all categories

**Step 7b — Import products**
See the products CSV format below. The `category` column will match by name — spelling must match exactly (case is ignored).

---

### Option B — Large catalog: import everything from CSV (recommended)

You do not need to create categories first. The product CSV import **auto-creates any category that doesn't exist yet**. This means one CSV file can set up your entire catalogue.

**Step 7a — Import categories (optional but recommended for large hierarchies)**

Copy `docs/templates/categories_template.csv` from the project, rename it to `categories.csv`, and fill in the client's categories. Replace the example rows with real data — keep the header row exactly as-is.

Column reference:

| Column | Required | Notes |
|--------|----------|-------|
| `name` | Yes | Category name |
| `description` | No | Short description |
| `parent` | No | **Exact name** of parent category — blank for top-level |
| `sort_order` | No | Lower numbers appear first (0, 1, 2...) |
| `is_active` | No | `true` or `false` — defaults to true |
| `image_url` | No | Public URL to a category image |

Rules:
- Parent rows must appear **above** their child rows in the file
- Re-importing is safe — existing categories are updated, not duplicated

In the admin panel → **Categories** → **Import CSV** → select your file. The banner shows how many were created/updated.

**Step 7b — Import products**

Copy `docs/templates/products_template.csv` from the project, rename it to `products.csv`, and fill in the client's products.

| Column | Required | Format | Notes |
|--------|----------|--------|-------|
| `name` | Yes | Text | Product name |
| `price` | Yes | Number | No currency symbol (`29.99` not `£29.99`) |
| `description` | No | Text | Plain text |
| `stock_quantity` | No | Whole number | Defaults to 0. **Ignored** for a product that already has real variants — see gotcha below |
| `category` | No | Text | Category name — auto-created if it doesn't exist |
| `sale_price` | No | Number | Only if on sale |
| `is_on_sale` | No | `true` or `false` | |
| `is_featured` | No | `true` or `false` | Featured products shown on homepage |
| `weight` | No | Number (kg) | |
| `tags` | No | Space-separated keywords | Used in search |

In the admin panel → **Products** → **Import CSV** → select your file.

**Gotcha — price format:** Use a decimal point, not a comma. `29.99` is correct. `29,99` will fail.

**Gotcha — re-importing:** Products are not de-duplicated on name — importing the same file twice creates duplicates. Only import a file once. To fix mistakes, delete the products and re-import.

**Gotcha — this CSV only creates simple, single-SKU products.** It cannot
create size/colour-style variants or set stock per variant. If a product
needs variants, import it via this CSV first (for the base name, price,
description, category, images), then in the admin go to that product →
**Variants tab** → add option types and values → **Generate combinations**
→ enter stock per variant. See *Stock is set per product variant* under
Section 6 above — until you do this, a variant product shows as out of
stock, and the flat `stock_quantity` column above has no effect on it.

**Gotcha — categories ARE de-duplicated:** Re-importing a categories CSV is safe — existing categories are updated, not duplicated.

---

## Section 8 — Landing page

The landing page is the client's homepage at `http://IP:3000`. It is built from sections you add in the admin panel.

1. In the admin panel, click **Landing Page**
2. Click **+ Add Section**
3. Choose a section type:

| Section type | What it shows |
|--------------|--------------|
| `hero` | Large banner with title, subtitle, image, and a button |
| `features` | Three-column feature highlight |
| `products` | Auto-populates with featured products from the catalogue |
| `testimonials` | Customer quotes |
| `cta` | Call-to-action strip with a button |
| `html` | Raw HTML — for custom content |
| `block` | Pre-built component blocks (banners, grids, etc.) |

4. Fill in the fields for the section and click **Add Section**
5. Use the eye icon to show/hide sections without deleting them
6. Sort order: lower numbers appear first (e.g. hero at 0, features at 1, products at 2)

**Gotcha — hero image:** The Image URL must be a publicly hosted image. Same constraint as the logo — use Cloudinary or similar.

---

## Section 9 — Handoff checklist

Before giving the client access, verify each item:

- [ ] All three containers running: `docker compose ps`
- [ ] Storefront loads at `http://IP:3000`
- [ ] Admin panel loads at `http://IP:3001`
- [ ] Client can log in with their own password
- [ ] Store name and branding appear correctly on the storefront
- [ ] At least one category exists
- [ ] Products are visible on the storefront
- [ ] Homepage has at least a hero section

Send the client:
- Admin panel URL: `http://IP:3001`
- Their email address (they already set their password via the reset link)
- A brief note on what they can manage: products, orders, categories, branding

---

## Updating code on an existing deployment

When new code is released, run this on the server:

```bash
cd /opt/commerceforce/CommerceForceClaude
git pull
docker compose up --build -d
docker compose exec backend alembic upgrade head
```

The last command is safe to run every time even if there are no new migrations.

---

## Quick reference — useful commands

```bash
# Check all containers are running
docker compose ps

# View live logs (all services)
docker compose logs -f

# View one service only
docker compose logs -f backend

# Restart backend only (e.g. after changing .env)
docker compose restart backend

# Rebuild and restart everything
docker compose up --build -d

# Stop everything (keeps data)
docker compose down

# Stop and DELETE all data — only use to start fresh
docker compose down -v
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Site can't be reached" | Firewall ports closed | `ufw allow 3000 && ufw allow 3001 && ufw allow 8000` |
| Page loads but everything errors | Database tables don't exist | `docker compose exec backend python init_db.py` then `docker compose exec backend alembic stamp head` |
| `SERVER_IP variable is not set` | Root `.env` missing | Create `/opt/.../CommerceForceClaude/.env` with `SERVER_IP=x.x.x.x` |
| `ADMIN_EMAIL is not set` | Missing var in `backend/.env` | Add the missing line to `backend/.env`, then `docker compose restart backend` |
| Backend container keeps restarting | Startup error | `docker compose logs backend` to see the error |
| "No such table" errors in logs | Schema not initialised | `docker compose exec backend python init_db.py` then `docker compose exec backend alembic stamp head` |
| `no such table: product_variants` during `alembic upgrade head` | Old image predating the fix in migration `a0b1c2d3e4f5` | Rebuild/pull the latest backend image; on current code `alembic upgrade head` works on an empty DB, or use `python init_db.py` + `alembic stamp head` (see Section 4.1) |
| `No module named 'aiosqlite'` | Old Docker image | `docker compose up --build -d` |
| Forgot Password: no email arrives | VPS blocks SMTP port 587 | Get link from logs: `docker compose logs backend \| grep "PASSWORD RESET"` |
| Can't log in as superadmin/admin | Account missing or password differs from DB | See `docs/accounts-and-passwords.md` (check accounts, create-or-reset from `.env`) |
| Constant logouts / new tab drops to login | Running on HTTP but refresh cookie is `Secure` | Set `COOKIE_SECURE=false` in `backend/.env`, then `docker compose up -d --force-recreate backend` |
| Backend becomes unresponsive under load, needs restart | (Fixed) SQLite now uses WAL + busy timeout | Pull latest and rebuild backend; no config needed |
| CSV import: products created but no category | Category name typo in CSV | Products CSV auto-creates categories now — check the category was created |
| CSV import: "invalid price" error | Price uses comma instead of period | Change `29,99` to `29.99` in the CSV |
| Category CSV: "parent not found" error | Parent row appears after child in the file | Move parent rows above child rows in the CSV |
| Products duplicated after re-import | Products CSV was imported twice | Re-importing a CSV now updates existing products instead of duplicating. If duplicates already exist, use **Admin → Products → Find duplicates** to clean them up. |

---

## Section 10 — Backups and recovery

### 10.1 Daily automated backup

The backup runs automatically via the `backup` service in `docker-compose.yml`. It starts with the rest of the application — no manual setup required. The backup service:
- Runs `scripts/docker-backup.sh` inside an Alpine container at 02:00 UTC every day
- Uses SQLite's safe online backup API — safe to run against the live database without locking
- Saves to the `cf_backups` Docker volume as `YYYY-MM-DD.db`
- Automatically prunes backups older than 30 days

**Optional VPS cron fallback** — if you want a redundant on-disk backup in addition to the Docker volume:

```bash
crontab -e
```

Add this line:
```
0 3 * * * docker compose -f /opt/commerceforce/CommerceForceClaude/docker-compose.yml exec -T backup /usr/local/bin/run-backup >> /var/log/commerceforce-backup.log 2>&1
```

### 10.2 On-demand backup

Run at any time:
```bash
cd /opt/commerceforce/CommerceForceClaude
bash scripts/backup.sh
```

### 10.3 Verify a backup

```bash
sqlite3 backups/YYYY-MM-DD.db "SELECT COUNT(*) FROM users;"
```
Should return a number. If it prints an error, the backup is corrupt — check logs and re-run.

### 10.4 Restore from backup

```bash
# 1. Stop the backend
docker compose stop backend

# 2. Copy the backup over the live database
CONTAINER=$(docker compose ps -q backend)
docker cp backups/YYYY-MM-DD.db ${CONTAINER}:/app/data/commerceforce.db

# 3. Restart
docker compose start backend

# 4. Verify the site is working
curl http://YOUR_SERVER_IP:8000/api/health
```

**Important:** Stop the backend BEFORE replacing the database file. Replacing while the server is running can corrupt the database.

---

## Section 11 — HTTPS + nginx + custom domain

### Prerequisites before this section

- DNS is already configured: `yourdomain.com` and `admin.yourdomain.com` both point to your VPS IP
- Port 80 and 443 are open in your firewall: `ufw allow 80 && ufw allow 443`
- The site is already running on HTTP (Section 3 complete)

### 11.1 Add DOMAIN to root .env

Edit `.env` (next to `docker-compose.yml`) and add your domain:

```
SERVER_IP=YOUR.SERVER.IP.HERE
DOMAIN=yourdomain.com
```

Or re-run the env generator and supply the domain when prompted:
```bash
bash scripts/generate-env.sh
```

### 11.2 Issue the SSL certificate with certbot

Run certbot in standalone mode (before enabling the nginx service). This temporarily binds to port 80:

```bash
docker run --rm -it \
  -v cf_letsencrypt:/etc/letsencrypt \
  -v cf_certbot_www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d yourdomain.com -d admin.yourdomain.com \
  --email info@yourdomain.com --agree-tos --no-eff-email
```

This writes the certificates to the Docker volume `cf_letsencrypt`. You should see:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/yourdomain.com/fullchain.pem
```

### 11.3 Enable the nginx service in docker-compose.yml

Open `docker-compose.yml` and uncomment the `nginx:` and `certbot:` service blocks (lines starting with `#`), and uncomment the two volumes at the bottom (`cf_letsencrypt`, `cf_certbot_www`).

Then rebuild and restart:
```bash
docker compose up --build -d
```

### 11.4 Verify HTTPS is working

```bash
# Should return 301 redirect to https://
curl -I http://yourdomain.com

# Should return 200
curl -I https://yourdomain.com

# Check SSL certificate details
curl -vI https://yourdomain.com 2>&1 | grep "SSL certificate"
```

Open your browser and visit `https://yourdomain.com` — padlock should show.

### 11.5 Set up automatic certificate renewal

Certbot certificates expire after 90 days. Add a weekly renewal cron:

```bash
crontab -e
```

Add:
```
0 3 * * 1 docker compose -f /opt/commerceforce/CommerceForceClaude/docker-compose.yml run --rm certbot renew --quiet >> /var/log/certbot-renew.log 2>&1
```

Test renewal:
```bash
docker compose run --rm certbot renew --dry-run
```
Should print: `Congratulations, all simulated renewals succeeded.`

### 11.6 Update backend/.env for HTTPS URLs

The env generator already wrote HTTPS URLs when you provided a domain. If you're adding the domain to an existing deployment, update `backend/.env`:

```
CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
STOREFRONT_URL=https://yourdomain.com
ADMIN_URL=https://admin.yourdomain.com
```

Then restart the backend:
```bash
docker compose restart backend
```

**Gotcha — port exposure after enabling nginx:** Once nginx is set up and verified, remove the direct port mappings (`- "3000:3000"`, `- "3001:3001"`, `- "8000:8000"`) from `docker-compose.yml` and restart. This prevents bypassing nginx via the raw ports.
