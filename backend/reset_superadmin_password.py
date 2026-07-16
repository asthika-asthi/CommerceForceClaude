r"""reset_superadmin_password.py — LOCAL (no Docker) superadmin password recovery.

WHAT THIS IS FOR
  "Invalid credentials" logging in as superadmin locally, even though you're
  typing exactly what's in backend/.env's SUPERADMIN_PASSWORD.

  Same root cause as the VPS incident (see scripts/reset-superadmin-password.sh):
  seed.py only sets the password when it FIRST creates the account, so a later
  edit to SUPERADMIN_PASSWORD in backend/.env never reaches the database.
  A second local trap: DATABASE_URL uses a RELATIVE path (./commerceforce.db),
  so starting the backend from the wrong directory creates a fresh, empty DB
  where your superadmin doesn't exist at all. This script always targets the
  real DB next to this file, regardless of where you run it from.

USAGE (local dev, Windows or POSIX — pick your shell):
  PowerShell:  cd D:\Projects\20260609_Commerceforce\backend
               .venv\Scripts\python.exe reset_superadmin_password.py
  Git Bash:    cd /d/Projects/20260609_Commerceforce/backend
               ./.venv/Scripts/python.exe reset_superadmin_password.py

  Then log in with the SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD currently in
  backend/.env. Safe to re-run any time. The backend does NOT need restarting.

ON THE VPS use scripts/reset-superadmin-password.sh instead (Docker version).
"""
import asyncio
import os
import sys

# Anchor everything to this file's directory so the relative DATABASE_URL
# (sqlite:///./commerceforce.db) always resolves to backend/commerceforce.db,
# no matter which directory the user ran the command from.
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")

from dotenv import load_dotenv  # noqa: E402

load_dotenv(".env")

from sqlalchemy import select  # noqa: E402

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.plugins.auth.models import User, UserRole  # noqa: E402
from app.plugins.auth.service import get_password_hash  # noqa: E402

email = os.getenv("SUPERADMIN_EMAIL", "").strip()
password = os.getenv("SUPERADMIN_PASSWORD", "").strip()
if not email or not password:
    sys.exit("ERROR: SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set in backend/.env")


async def go() -> None:
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if u is None:
            db.add(
                User(
                    email=email,
                    first_name="Super",
                    last_name="Admin",
                    role=UserRole.superadmin,
                    is_active=True,
                    is_email_verified=True,
                    hashed_password=get_password_hash(password),
                )
            )
            print(f">> created superadmin: {email}")
        else:
            u.hashed_password = get_password_hash(password)
            u.role = UserRole.superadmin
            u.is_active = True
            u.is_email_verified = True
            print(f">> reset password for: {email}")
        await db.commit()


asyncio.run(go())
print(">> Done. Log in with the SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD from backend/.env.")
