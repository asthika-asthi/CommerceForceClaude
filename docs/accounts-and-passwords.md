# Accounts & Passwords — Recovery Guide

Practical commands for when you can't log in, need to reset a password, or want to check
which accounts exist. All commands run **inside Docker on the server** — you do not need
Python installed on the host.

> Run these from the project folder on the VPS (the one with `docker-compose.yml`),
> e.g. `cd /opt/commerceforce/CommerceForceClaude`.

---

## How credentials actually work (read this once)

- **Nothing is hardcoded.** Superadmin/admin credentials come only from `backend/.env`
  (`SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD`, `ADMIN_EMAIL`/`ADMIN_TEMP_PASSWORD`).
- **The database never stores the plaintext password** — it stores a one-way **hash**,
  computed **when `seed.py` runs**. Login hashes what you type and compares it to that hash.
- **Two gotchas that cause most "can't log in" issues:**
  1. **`seed.py` skips accounts that already exist** — changing a password in `.env` and
     re-running the seed does **not** update an existing account.
  2. If the seed **aborted** (e.g. a missing env var), the account was **never created**.
- **Where to log in:** admin & superadmin use the **admin panel** (`http://your-domain:3001`),
  **not** the storefront (`:3000`).
- **Email verification** blocks unverified *customers* only — admin/superadmin are exempt, so
  it never affects your login.

**The normal way to change a password** is the storefront/admin **"Forgot password"** link
(emails a reset link). The commands below are for **recovery** — when email isn't set up yet,
or the account is missing/locked.

---

## 1. Check which accounts exist

```bash
docker compose exec -T backend python - <<'PY'
import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.plugins.auth.models import User
async def go():
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(User).order_by(User.role))).scalars().all()
        if not rows:
            print(">> No users at all — run the seed / init first.")
        for u in rows:
            print(f">> {u.role:12} {u.email:35} active={u.is_active} verified={u.is_email_verified}")
asyncio.run(go())
PY
```
Use the exact **email** shown here to log in.

---

## 2. Create or reset the **superadmin** from `.env`

Handles both cases (missing account **or** wrong password). Uses `run --rm` so it reads your
**current** `backend/.env`:

```bash
docker compose run --rm -T backend python - <<'PY'
import os, asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.plugins.auth.models import User, UserRole
from app.plugins.auth.service import get_password_hash
email = os.getenv("SUPERADMIN_EMAIL","").strip()
password = os.getenv("SUPERADMIN_PASSWORD","").strip()
assert email and password, "SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set in backend/.env"
async def go():
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.email==email))).scalar_one_or_none()
        if u is None:
            db.add(User(email=email, first_name="Super", last_name="Admin",
                        role=UserRole.superadmin, is_active=True, is_email_verified=True,
                        hashed_password=get_password_hash(password)))
            print(">> created superadmin:", email)
        else:
            u.hashed_password = get_password_hash(password)
            u.role = UserRole.superadmin; u.is_active = True; u.is_email_verified = True
            print(">> reset password for:", email)
        await db.commit()
asyncio.run(go())
PY
```

---

## 3. Create or reset the **admin** from `.env`

Same as above but for the client admin (`ADMIN_EMAIL` / `ADMIN_TEMP_PASSWORD`):

```bash
docker compose run --rm -T backend python - <<'PY'
import os, asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.plugins.auth.models import User, UserRole
from app.plugins.auth.service import get_password_hash
email = os.getenv("ADMIN_EMAIL","").strip()
password = os.getenv("ADMIN_TEMP_PASSWORD","").strip()
assert email and password, "ADMIN_EMAIL / ADMIN_TEMP_PASSWORD not set in backend/.env"
async def go():
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.email==email))).scalar_one_or_none()
        if u is None:
            db.add(User(email=email, first_name="Admin", last_name="User",
                        role=UserRole.admin, is_active=True, is_email_verified=True,
                        hashed_password=get_password_hash(password)))
            print(">> created admin:", email)
        else:
            u.hashed_password = get_password_hash(password)
            u.role = UserRole.admin; u.is_active = True; u.is_email_verified = True
            print(">> reset password for:", email)
        await db.commit()
asyncio.run(go())
PY
```

---

## 4. Reset **any** user's password to a value you choose

For a specific account (any role). **Edit the two values** at the top before running:

```bash
docker compose exec -T backend python - <<'PY'
TARGET_EMAIL = "person@example.com"     # <-- change
NEW_PASSWORD = "ChooseAStrongOne123!"   # <-- change

import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.plugins.auth.models import User
from app.plugins.auth.service import get_password_hash
async def go():
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.email==TARGET_EMAIL))).scalar_one_or_none()
        if u is None:
            print(">> No user with that email."); return
        u.hashed_password = get_password_hash(NEW_PASSWORD)
        u.is_active = True
        await db.commit()
        print(">> password reset for:", TARGET_EMAIL)
asyncio.run(go())
PY
```

---

## 5. Re-run the seed (fresh accounts + branding)

If the database is empty (or you just initialised it), create the seeded accounts/branding.
`run --rm` reads the current `.env`:

```bash
docker compose run --rm backend python seed.py          # accounts + branding
docker compose run --rm backend python seed.py --demo   # also add sample products
```
Remember: the seed **skips** anything that already exists — use sections 2–4 to change an
existing account's password.

---

## Quick troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "Invalid credentials" for superadmin/admin | Account never created (seed aborted) **or** password differs from what's in the DB | Section 1 to check; section 2/3 to create-or-reset |
| Changed password in `.env`, still can't log in | Seed **skips** existing accounts | Section 2/3 (they overwrite the existing account) |
| `SUPERADMIN_PASSWORD is not set` when seeding | Missing/misspelled var, spaces around `=`, or stale container | Fix `backend/.env` (no spaces, no quotes), then `docker compose up -d --force-recreate backend` |
| Logs in on `:3000` but no admin tools | That's the **storefront** | Use the **admin panel** on `:3001` |
| "Please verify your email" | You're using a **customer** account | Verify via the emailed link, or use an admin/superadmin account (exempt) |

> Note: these recovery commands write directly to the database. They're safe to re-run, but
> always prefer the in-app **Forgot Password** flow once email is configured.
