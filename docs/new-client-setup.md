# CommerceForce — New Client Setup Guide

This is the complete guide for delivering a CommerceForce store to a new client.
Follow every section in order. Do not skip steps.

---

## Overview of the full process

1. Server provisioning and firewall
2. Clone and configure environment files
3. Build and start the application
4. Create database tables and seed accounts
5. Client first login
6. Branding and visual identity
7. Plugin selection (which features to enable)
8. Categories
9. Product catalog (CSV import)
10. Landing page setup
11. Hand off to client

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

### 2.2 Create the root `.env` file
This file sits next to `docker-compose.yml`. It sets the server IP so all services know how to talk to each other.

```bash
nano .env
```
Paste:
```
SERVER_IP=YOUR.SERVER.IP.HERE
```
Replace `YOUR.SERVER.IP.HERE` with the actual IP (e.g. `187.77.101.178`). Save with `Ctrl+X`, `Y`, `Enter`.

**Gotcha:** If you skip this file, Docker Compose will fail with `SERVER_IP variable is not set`.

### 2.3 Create `backend/.env`
This file holds all secrets and per-client configuration. **Never commit this file to git.**

```bash
nano backend/.env
```

Paste the full template below and fill in every value:

```
# ── Security ────────────────────────────────────────────────────────────
SECRET_KEY=<run: openssl rand -hex 32>
ENVIRONMENT=production

# ── Database ─────────────────────────────────────────────────────────────
DATABASE_URL=sqlite+aiosqlite:///./commerceforce.db

# ── Plugins (see Section 7 for what each one does) ───────────────────────
ENABLED_PLUGINS=auth,categories,products,cart,orders,checkout,coupons,loyalty,newsletter,branding,landing_page,ai_chat,rfq,credit,inventory,contact,addresses,wishlist,reviews,discount_rules

# ── Tokens ───────────────────────────────────────────────────────────────
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# ── Redis (not used in current SQLite mode — leave as-is) ────────────────
REDIS_URL=redis://localhost:6379/0

# ── CORS (do not change — overridden by docker-compose.yml) ──────────────
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# ── Email / SMTP ─────────────────────────────────────────────────────────
# See Section 4 gotcha on email before filling this in
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
SMTP_FROM=your@gmail.com
SMTP_TLS=true

# ── AI Chat (optional) ───────────────────────────────────────────────────
OPENROUTER_API_KEY=your-key-here
OPENROUTER_MODEL=anthropic/claude-haiku-4.5

# ── Payments (optional) ──────────────────────────────────────────────────
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# ── Agency account (same for every client deployment) ────────────────────
SUPERADMIN_EMAIL=you@youragency.com
SUPERADMIN_PASSWORD=YourSecureAgencyPassword123!

# ── Client identity (change for every new client) ────────────────────────
ADMIN_EMAIL=owner@clientdomain.com
ADMIN_TEMP_PASSWORD=ChangeMe123!
STORE_NAME=Client Store Name
STORE_TAGLINE=Client tagline here
CONTACT_EMAIL=info@clientdomain.com
```

Save with `Ctrl+X`, `Y`, `Enter`.

**Gotcha — SECRET_KEY:** Generate a unique key for each deployment. Run this and paste the output:
```bash
openssl rand -hex 32
```

**Gotcha — SMTP_PASSWORD:** This must be a Gmail App Password (16 characters), not your regular Gmail password. Generate one at: Google Account → Security → 2-Step Verification → App Passwords. Even then, some VPS providers block outbound port 587. See Section 4 for the fallback.

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
docker compose exec backend alembic upgrade head
```

This creates all the database tables. **Must be run once on first deployment.** If you skip this, every page on the storefront will error.

It is safe to run again — it skips tables that already exist.

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
| `credit` | Store credit / account credit |
| `inventory` | Stock management and low-stock alerts |
| `contact` | Contact form |
| `addresses` | Saved delivery addresses |
| `wishlist` | Customer wishlists |
| `reviews` | Product reviews |
| `discount_rules` | Automatic discounts (e.g. 10% off orders over £100) |
| `promotions` | Promotional banners |
| `announcements` | Site-wide announcement bar |

**To change enabled plugins:**
1. Edit `backend/.env` on the server — update the `ENABLED_PLUGINS` line
2. Run `docker compose restart backend` (no rebuild needed)

**Gotcha:** Removing a plugin hides its admin menu but does not delete its data. Re-enabling it restores full access to the data.

---

## Section 7 — Categories

Categories must exist before products can be assigned to them.

1. In the admin panel, click **Categories**
2. Type the category name (e.g. `Tarpaulins`) and click **Create Category**
3. Repeat for all categories
4. Subcategories: create the parent first, then create the child and select the parent in the **Parent Category** dropdown

Write down your category names exactly as typed — you will use them in the CSV import.

---

## Section 8 — Product catalog (CSV import)

### 8.1 Prepare the CSV file

Create a file called `products.csv` on your computer. The columns are:

| Column | Required | Format | Notes |
|--------|----------|--------|-------|
| `name` | Yes | Text | Product name |
| `price` | Yes | Number | No currency symbol (e.g. `29.99`) |
| `description` | No | Text | Plain text or HTML |
| `stock_quantity` | No | Whole number | Defaults to 0 if blank |
| `category` | No | Text | Must match a category name exactly (case-insensitive) |
| `sale_price` | No | Number | Only fill if product is on sale |
| `is_on_sale` | No | `true` or `false` | |
| `is_featured` | No | `true` or `false` | Featured products appear highlighted |
| `weight` | No | Number (kg) | Used for shipping calculations |
| `tags` | No | Text | Comma-separated keywords |

Example:
```
name,price,description,stock_quantity,category,sale_price,is_on_sale,is_featured,weight,tags
Heavy Duty Tarpaulin 4x6m,29.99,Waterproof 280gsm blue tarpaulin,50,Tarpaulins,,false,true,1.5,tarpaulin waterproof
Ground Sheet 3x3m,14.99,Lightweight ground cover,100,Ground Sheets,,false,false,0.8,groundsheet
Premium Tarpaulin 6x8m,59.99,Heavy duty 350gsm,30,Tarpaulins,49.99,true,true,2.8,tarpaulin premium
```

**Gotcha — category spelling:** The category column is matched against what you created in Section 7. If the spelling doesn't match, the product imports without a category (no error is shown for this).

**Gotcha — price format:** Use a decimal point, not a comma. `29.99` is correct. `29,99` will fail.

### 8.2 Run the import

1. In the admin panel, click **Products**
2. Click **Import CSV** (top right)
3. Select your `products.csv` file
4. A banner confirms how many products were created and lists any rows that failed

Rows that fail are skipped — the rest still import. Fix the failed rows and re-import; it will add only the missing ones.

---

## Section 9 — Landing page

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

## Section 10 — Handoff checklist

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
| Page loads but everything errors | Database tables don't exist | `docker compose exec backend alembic upgrade head` |
| `SERVER_IP variable is not set` | Root `.env` missing | Create `/opt/.../CommerceForceClaude/.env` with `SERVER_IP=x.x.x.x` |
| `ADMIN_EMAIL is not set` | Missing var in `backend/.env` | Add the missing line to `backend/.env`, then `docker compose restart backend` |
| Backend container keeps restarting | Startup error | `docker compose logs backend` to see the error |
| "No such table" errors in logs | Migrations not run | `docker compose exec backend alembic upgrade head` |
| `No module named 'aiosqlite'` | Old Docker image | `docker compose up --build -d` |
| Forgot Password: no email arrives | VPS blocks SMTP port 587 | Get link from logs: `docker compose logs backend \| grep "PASSWORD RESET"` |
| CSV import: products created but no category | Category name typo in CSV | Check spelling matches exactly what's in the Categories page |
| CSV import: "invalid price" error | Price uses comma instead of period | Change `29,99` to `29.99` in the CSV |
