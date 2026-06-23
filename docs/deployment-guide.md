# CommerceForce — Production Deployment Guide

This guide covers everything needed to deploy CommerceForce to a Linux VPS from scratch.
Run every step in order. Do not skip steps.

---

## Prerequisites

### Firewall ports to open on the VPS
```bash
ufw allow 22      # SSH
ufw allow 8000    # Backend API
ufw allow 3000    # Storefront
ufw allow 3001    # Admin panel
```

### Software required on the VPS
- Docker + Docker Compose (install via `apt install docker.io docker-compose-plugin`)
- Git (`apt install git`)

---

## First-Time Deployment

### Step 1 — Clone the repository
```bash
cd /opt
mkdir commerceforce && cd commerceforce
git clone https://github.com/asthika-asthi/CommerceForceClaude.git
cd CommerceForceClaude
```

### Step 2 — Create the root `.env` file
This file lives next to `docker-compose.yml`. It tells Docker Compose the server IP.

```bash
nano .env
```
Paste:
```
SERVER_IP=YOUR.SERVER.IP.HERE
```
Save and exit (`Ctrl+X`, `Y`, `Enter`).

### Step 3 — Create `backend/.env`
This file holds all backend credentials. **Never commit this file to git.**

```bash
nano backend/.env
```
Paste and fill in every value:
```
SECRET_KEY=<generate with: openssl rand -hex 32>
ENVIRONMENT=production

DATABASE_URL=sqlite+aiosqlite:///./commerceforce.db

ENABLED_PLUGINS=auth,categories,products,cart,orders,checkout,coupons,loyalty,newsletter,branding,landing_page,ai_chat,rfq,credit,inventory,contact,addresses,wishlist,reviews,discount_rules

ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

REDIS_URL=redis://localhost:6379/0

CORS_ORIGINS=http://localhost:3000,http://localhost:3001

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your@email.com
SMTP_TLS=true

OPENROUTER_API_KEY=your-key-here
OPENROUTER_MODEL=anthropic/claude-haiku-4.5

STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# --- Agency (superadmin) — same across all client deployments ---
SUPERADMIN_EMAIL=you@agency.com
SUPERADMIN_PASSWORD=YourSecureAgencyPassword123!

# --- Client identity (change these per client) ---
ADMIN_EMAIL=owner@client.com
ADMIN_TEMP_PASSWORD=ChangeMe123!
STORE_NAME=Client Store Name
STORE_TAGLINE=Client tagline here
CONTACT_EMAIL=info@client.com
```
Save and exit.

### Step 4 — Build and start all containers
```bash
docker compose up --build -d
```
This builds 3 Docker images (backend, storefront, admin panel) and starts them.
It takes a few minutes on first run.

### Step 5 — Create database tables
```bash
docker compose exec backend alembic upgrade head
```
This creates all the database tables. Only needed once per fresh database.

### Step 6 — Create user accounts and branding
```bash
docker compose exec backend python seed.py
```
This creates the superadmin account, the client admin account, and sets the store branding.

### Step 7 — Verify all containers are running
```bash
docker compose ps
```
All three services should show status `running`.

### Step 8 — Get the admin login link
After seeding, the admin account has a temporary password from `.env`. The client sets their own password via the Forgot Password flow. But email delivery may fail on some VPS providers because they block outbound SMTP.

**Always get the reset link from the logs as a fallback:**
```bash
docker compose logs backend | grep "PASSWORD RESET"
```
This prints the reset link even when email fails. Send this link directly to the client.

**Tell the client:**
1. Go to the link from the logs above
2. Set their own password
3. Then log in at `http://YOUR.SERVER.IP:3001` with their email and new password

**If email is working**, the client can also use Forgot Password directly from the login page.

---

### Troubleshooting email (SMTP not working)

Run this to see the exact error:
```bash
docker compose logs backend | grep "Email"
```

**Common causes:**
- VPS blocks outbound port 587 (very common) — contact your VPS provider or use port 465
- Gmail App Password required — generate at: Google Account → Security → 2-Step Verification → App Passwords
  - Use the 16-character app password, not your normal Gmail password

---

## URLs

| URL | What it is |
|-----|-----------|
| `http://SERVER_IP:3000` | Customer-facing storefront |
| `http://SERVER_IP:3001` | Admin panel (for client staff) |
| `http://SERVER_IP:8000/api/docs` | Backend API docs |

---

## Updating an Existing Deployment

When new code is pushed, run this on the server:

```bash
cd /opt/commerceforce/CommerceForceClaude
git pull
docker compose up --build -d
```

If the update includes database changes (new tables or columns), also run:
```bash
docker compose exec backend alembic upgrade head
```
When in doubt, run it — it is safe to run multiple times.

---

## Useful Commands

```bash
# Check all containers are running
docker compose ps

# View live logs from all services
docker compose logs -f

# View logs from one service only
docker compose logs -f backend
docker compose logs -f frontend-starter
docker compose logs -f frontend-admin

# Restart everything without rebuilding
docker compose restart

# Stop everything
docker compose down

# Stop and delete all data (WARNING: deletes the database)
docker compose down -v
```

---

## New Client Deployment (existing server)

For a new client on the same server, create a new git branch and update:
1. `backend/.env` — update `ADMIN_EMAIL`, `ADMIN_TEMP_PASSWORD`, `STORE_NAME`, `STORE_TAGLINE`, `CONTACT_EMAIL`
2. `backend/.env` — update `SERVER_IP` in the root `.env` if the server IP changed
3. Run Steps 4–8 above

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `No module named 'aiosqlite'` | Run `docker compose up --build -d` (rebuilds with latest dependencies) |
| `no such table: products` | Run `docker compose exec backend alembic upgrade head` |
| `SERVER_IP variable is not set` | Create root `.env` with `SERVER_IP=your.ip` |
| `ADMIN_EMAIL is not set` | Add missing vars to `backend/.env` |
| Site not reachable in browser | Run `ufw allow 8000`, `ufw allow 3000`, `ufw allow 3001` |
| Container keeps restarting | Run `docker compose logs -f backend` to see the error |
