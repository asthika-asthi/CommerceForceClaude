r"""clear_2fa.py — LOCAL (no Docker) two-factor-auth lockout recovery.

WHAT THIS IS FOR
  An account has email-code 2FA enabled but can no longer receive the codes
  (lost mailbox access, broken SMTP), and no superadmin is available to clear it
  from the admin panel. There are no backup codes by design, so this script is
  the escape hatch: it switches 2FA off for one account and invalidates any
  outstanding codes. The user can then log in with just their password.

  Like reset_superadmin_password.py, this always targets the real DB next to this
  file (backend/commerceforce.db), regardless of where you run it from — the
  relative DATABASE_URL (sqlite:///./commerceforce.db) otherwise resolves against
  the current directory and can silently hit an empty DB.

USAGE (local dev, Windows or POSIX):
  PowerShell:  cd D:\Projects\20260609_Commerceforce\backend
               .venv\Scripts\python.exe clear_2fa.py someone@example.com
  Git Bash:    cd /d/Projects/20260609_Commerceforce/backend
               ./.venv/Scripts/python.exe clear_2fa.py someone@example.com

  Safe to re-run. The backend does NOT need restarting.

ON THE VPS use the Docker equivalent (run the same logic inside the api
container), the same way scripts/reset-superadmin-password.sh mirrors
reset_superadmin_password.py.
"""
import asyncio
import os
import sys

# Anchor to this file's directory so the relative DATABASE_URL always resolves to
# backend/commerceforce.db, no matter where the command was run from.
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")

from dotenv import load_dotenv  # noqa: E402

load_dotenv(".env")

from sqlalchemy import select, update  # noqa: E402

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.plugins.auth.models import User, TwoFactorCode  # noqa: E402

email = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
if not email:
    sys.exit("USAGE: python clear_2fa.py <email>")


async def go() -> None:
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user is None:
            sys.exit(f"ERROR: no account found for {email}")
        if not user.is_2fa_enabled:
            print(f">> {email} does not have 2FA enabled — nothing to do.")
            return
        user.is_2fa_enabled = False
        await db.execute(
            update(TwoFactorCode)
            .where(TwoFactorCode.user_id == user.id, TwoFactorCode.used == False)  # noqa: E712
            .values(used=True)
        )
        await db.commit()
        print(f">> 2FA cleared for {email}. They can now log in with just their password.")


asyncio.run(go())
