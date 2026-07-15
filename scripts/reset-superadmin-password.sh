#!/usr/bin/env bash
# reset-superadmin-password.sh — Recovery: sync the superadmin DB password with backend/.env.
#
# WHAT THIS IS FOR
#   "Invalid credentials" logging in as superadmin even though you're typing
#   exactly what's in backend/.env's SUPERADMIN_PASSWORD.
#
#   Root cause: seed.py only sets the password when it FIRST creates the
#   superadmin account. If you edit SUPERADMIN_PASSWORD in backend/.env later
#   (e.g. re-running scripts/generate-env.sh for a port/config change), the
#   database still has the OLD password hash — seed.py skips accounts that
#   already exist, so nothing tells the DB about the new value. Login then
#   fails using the password that's sitting right there in .env.
#
#   This script re-hashes the CURRENT backend/.env SUPERADMIN_PASSWORD and
#   writes it into the existing DB row (or creates the account if it's
#   missing entirely). It is `docs/accounts-and-passwords.md` Section 2,
#   pulled out into its own file so it's a single command on the VPS instead
#   of a heredoc you have to copy-paste correctly under pressure.
#
# WHEN NOT TO USE
#   If you just want the client ADMIN's password reset instead of the
#   superadmin's, see docs/accounts-and-passwords.md Section 3 (same idea,
#   different account) — this script only ever touches SUPERADMIN_EMAIL.
#
# USAGE (run on the VPS, from the client's own directory):
#   cd /opt/commerceforce/<client>/CommerceForceClaude
#   bash scripts/reset-superadmin-password.sh
#
# This reads backend/.env fresh via `docker compose run --rm`, so it always
# uses whatever SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD is in the file right
# now — safe to re-run every time you change that value.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ ! -f "${PROJECT_ROOT}/docker-compose.yml" ]]; then
    echo "[reset-superadmin-password] ERROR: no docker-compose.yml found at ${PROJECT_ROOT}."
    echo "[reset-superadmin-password] Run this from a client's own directory (it contains scripts/ as a subfolder)."
    exit 1
fi

if [[ ! -f "${PROJECT_ROOT}/backend/.env" ]]; then
    echo "[reset-superadmin-password] ERROR: backend/.env not found — nothing to read SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD from."
    exit 1
fi

echo "[reset-superadmin-password] Syncing superadmin password from backend/.env into the database…"

docker compose -f "${PROJECT_ROOT}/docker-compose.yml" run --rm -T backend python - <<'PY'
import os, asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.plugins.auth.models import User, UserRole
from app.plugins.auth.service import get_password_hash

email = os.getenv("SUPERADMIN_EMAIL", "").strip()
password = os.getenv("SUPERADMIN_PASSWORD", "").strip()
assert email and password, "SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set in backend/.env"

async def go():
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if u is None:
            db.add(User(email=email, first_name="Super", last_name="Admin",
                        role=UserRole.superadmin, is_active=True, is_email_verified=True,
                        hashed_password=get_password_hash(password)))
            print(">> created superadmin:", email)
        else:
            u.hashed_password = get_password_hash(password)
            u.role = UserRole.superadmin
            u.is_active = True
            u.is_email_verified = True
            print(">> reset password for:", email)
        await db.commit()

asyncio.run(go())
PY

echo "[reset-superadmin-password] Done. Log in with the SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD currently in backend/.env."
