# Client Deployment Seeding — Design

**Date:** 2026-06-23
**Status:** Approved

## Context

CommerceForce is a white-label agency platform. Each client gets their own deployment (separate server, separate git branch). `seed.py` previously had hardcoded credentials and branding — a security risk and a manual error risk when delivering to real clients. This design makes seeding per-client configurable via `backend/.env` and adds a Change Password page to the admin panel.

---

## Design

### 1. `backend/.env` — new fields

Two new groups added to the per-server `.env` (never committed to git):

```
# --- Agency (superadmin) — same across all client deployments ---
SUPERADMIN_EMAIL=you@agency.com
SUPERADMIN_PASSWORD=AgencySecurePass123!

# --- Client identity (set per deployment) ---
ADMIN_EMAIL=owner@client.com
ADMIN_TEMP_PASSWORD=ChangeMe123!
STORE_NAME=Client Store Name
STORE_TAGLINE=Your tagline here
CONTACT_EMAIL=info@client.com
```

### 2. `backend/seed.py` — reads from env, two modes

- All credentials and branding read from `os.getenv()`
- Missing `ADMIN_EMAIL` or `STORE_NAME` → clear error + early exit (no silent wrong defaults)
- Fully idempotent — re-running skips anything already created

| Command | What it seeds |
|---------|--------------|
| `python seed.py` | Superadmin + admin + branding only — use for every real client |
| `python seed.py --demo` | Above + demo categories and products — use for dev/testing only |

### 3. Admin panel — Change Password page

- New page: `frontend-admin/app/(dashboard)/settings/page.tsx`
- Form: Current Password, New Password, Confirm New Password
- Calls existing `POST /api/auth/me/change-password` — no backend changes needed
- "Settings" link added to the sidebar nav
- Both admin and superadmin can use it

---

## Deployment Workflow (new client)

1. `git pull` on the server
2. Edit `backend/.env` — fill in the 5 client fields + 2 superadmin fields (first time only)
3. `docker compose up --build -d`
4. `docker compose exec backend python seed.py`
5. Tell client: use Forgot Password with their email to set their own password
6. Client logs in, imports products via CSV or enters manually

---

## Verification

- `python seed.py` with env vars set → admin + superadmin + branding created, no products
- `python seed.py --demo` → categories and 13 demo products also created
- `python seed.py` again → all steps skip ("already exists")
- `python seed.py` with `ADMIN_EMAIL` missing → clear error, early exit
- Admin panel Settings → change password → old password no longer works
