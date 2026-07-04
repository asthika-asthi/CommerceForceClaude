"""B7 — email verification required (hard-gate login) + resend flow.

Enforcement is behind settings.REQUIRE_EMAIL_VERIFICATION (default True in prod, False in
the test env). These tests flip it on to exercise the gate.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.config import settings
from app.plugins.auth.models import User

from tests.test_commerce import make_admin, register_and_token, CUSTOMER_DATA

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"
RESEND_URL = "/api/auth/resend-verification"


@pytest.fixture
def require_verification(monkeypatch):
    monkeypatch.setattr(settings, "REQUIRE_EMAIL_VERIFICATION", True)


async def test_unverified_customer_login_blocked(client: AsyncClient, db, require_verification):
    await client.post(REGISTER_URL, json=CUSTOMER_DATA)
    r = await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    assert r.status_code == 403


async def test_verified_customer_can_login(client: AsyncClient, db, require_verification):
    await client.post(REGISTER_URL, json=CUSTOMER_DATA)
    await db.execute(update(User).where(User.email == CUSTOMER_DATA["email"]).values(is_email_verified=True))
    await db.flush()

    r = await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    assert r.status_code == 200
    assert r.json()["access_token"]


async def test_admin_is_exempt_from_verification_gate(client: AsyncClient, db, require_verification):
    # make_admin registers, promotes to admin, and logs in — must succeed even though the
    # account was never email-verified, because admins don't self-register.
    token = await make_admin(client, db)
    assert token


async def test_verification_not_enforced_when_flag_off(client: AsyncClient, db):
    # Default test env has the flag off — unverified customers can still log in.
    await client.post(REGISTER_URL, json=CUSTOMER_DATA)
    r = await client.post(LOGIN_URL, json={"email": CUSTOMER_DATA["email"], "password": CUSTOMER_DATA["password"]})
    assert r.status_code == 200


async def test_resend_verification_regenerates_token(client: AsyncClient, db):
    await client.post(REGISTER_URL, json=CUSTOMER_DATA)
    user = (await db.execute(select(User).where(User.email == CUSTOMER_DATA["email"]))).scalar_one()
    original_token = user.email_verification_token

    r = await client.post(RESEND_URL, json={"email": CUSTOMER_DATA["email"]})
    assert r.status_code == 204

    db.expire_all()
    user = (await db.execute(select(User).where(User.email == CUSTOMER_DATA["email"]))).scalar_one()
    assert user.email_verification_token
    assert user.email_verification_token != original_token


async def test_resend_verification_unknown_email_is_silent(client: AsyncClient, db):
    # No account enumeration — always 204.
    r = await client.post(RESEND_URL, json={"email": "nobody@example.com"})
    assert r.status_code == 204
