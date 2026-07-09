"""Abandoned-cart recovery — recovery-email capture endpoint + the reminder
service function that the in-process scheduler calls periodically.
"""
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.plugins.auth.models import User
from app.plugins.cart.models import Cart
from app.shared.abandoned_cart import send_reminders
from app.shared.email import EmailLog

from tests.conftest import TestSessionLocal
from tests.test_commerce import make_admin, register_and_token, _create_product_and_variant, CUSTOMER_DATA


async def _get_cart(db, *, user_id: str | None = None, session_id: str | None = None) -> Cart:
    db.expire_all()
    query = select(Cart)
    query = query.where(Cart.user_id == user_id) if user_id else query.where(Cart.session_id == session_id)
    return (await db.execute(query)).scalar_one()


def _idle_cutoff() -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=settings.ABANDONED_CART_DELAY_HOURS + 1)


# ── recovery-email capture endpoint ─────────────────────────────────────────────

async def test_recovery_email_sets_cart_field(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    _pid, variant_id = await _create_product_and_variant(client, admin_token, name="Recovery Widget")
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1})

    r = await client.post("/api/cart/recovery-email", json={"email": "guest-recover@example.com"})
    assert r.status_code == 204

    session_id = client.cookies.get("guest_session")
    cart = await _get_cart(db, session_id=session_id)
    assert cart.recovery_email == "guest-recover@example.com"


async def test_recovery_email_invalid_email_rejected(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    _pid, variant_id = await _create_product_and_variant(client, admin_token, name="Invalid Email Widget")
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1})

    r = await client.post("/api/cart/recovery-email", json={"email": "not-an-email"})
    assert r.status_code == 422


async def test_recovery_email_noop_for_logged_in_user(client: AsyncClient, db):
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    r = await client.post("/api/cart/recovery-email", json={"email": "ignored@example.com"},
                           headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 204


async def test_recovery_email_is_rate_limited(client: AsyncClient, db, reset_rate_limiter):
    # 3/minute — the 4th request in a window must be throttled with 429.
    statuses = []
    for _ in range(4):
        r = await client.post("/api/cart/recovery-email", json={"email": "rl@example.com"})
        statuses.append(r.status_code)
    assert 429 in statuses, f"recovery-email should be rate limited, got {statuses}"
    assert statuses[:3] == [204, 204, 204], f"first 3 should succeed, got {statuses}"


# ── send_reminders() — the periodic job body ────────────────────────────────────

async def test_send_reminders_emails_idle_guest_cart_with_recovery_email(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    _pid, variant_id = await _create_product_and_variant(client, admin_token, name="Idle Widget")
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 2})
    await client.post("/api/cart/recovery-email", json={"email": "idle-cart@example.com"})

    session_id = client.cookies.get("guest_session")
    cart = await _get_cart(db, session_id=session_id)
    cart.updated_at = _idle_cutoff()
    await db.flush()
    await db.commit()

    sent = await send_reminders(TestSessionLocal)
    assert sent == 1

    log = (await db.execute(select(EmailLog).where(EmailLog.recipient == "idle-cart@example.com"))).scalar_one()
    assert "Idle Widget" in log.body

    db.expire_all()
    cart = await _get_cart(db, session_id=session_id)
    assert cart.reminder_sent_at is not None


async def test_send_reminders_skips_recently_updated_cart(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    _pid, variant_id = await _create_product_and_variant(client, admin_token, name="Fresh Widget")
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1})
    await client.post("/api/cart/recovery-email", json={"email": "fresh-cart@example.com"})
    await db.commit()

    sent = await send_reminders(TestSessionLocal)
    assert sent == 0


async def test_send_reminders_skips_already_reminded_cart(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    _pid, variant_id = await _create_product_and_variant(client, admin_token, name="Already Reminded Widget")
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1})
    await client.post("/api/cart/recovery-email", json={"email": "already@example.com"})

    session_id = client.cookies.get("guest_session")
    cart = await _get_cart(db, session_id=session_id)
    cart.updated_at = _idle_cutoff()
    cart.reminder_sent_at = datetime.now(timezone.utc)
    await db.flush()
    await db.commit()

    sent = await send_reminders(TestSessionLocal)
    assert sent == 0


async def test_send_reminders_skips_cart_with_no_email(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    _pid, variant_id = await _create_product_and_variant(client, admin_token, name="No Email Widget")
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1})
    # No recovery-email captured, and no logged-in user.

    session_id = client.cookies.get("guest_session")
    cart = await _get_cart(db, session_id=session_id)
    cart.updated_at = _idle_cutoff()
    await db.flush()
    await db.commit()

    sent = await send_reminders(TestSessionLocal)
    assert sent == 0


async def test_send_reminders_resolves_logged_in_user_email(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    cust_token = await register_and_token(client, CUSTOMER_DATA)
    _pid, variant_id = await _create_product_and_variant(client, admin_token, name="Account Widget")
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1},
                       headers={"Authorization": f"Bearer {cust_token}"})

    user_id = (await db.execute(select(User.id).where(User.email == CUSTOMER_DATA["email"]))).scalar_one()
    cart = await _get_cart(db, user_id=user_id)
    cart.updated_at = _idle_cutoff()
    await db.flush()
    await db.commit()

    sent = await send_reminders(TestSessionLocal)
    assert sent == 1
    # Registration also sends a verification email to the same address, so
    # filter by subject to isolate the reminder specifically.
    log = (await db.execute(
        select(EmailLog).where(
            EmailLog.recipient == CUSTOMER_DATA["email"],
            EmailLog.subject == "You left something in your cart",
        )
    )).scalar_one()
    assert log.recipient == CUSTOMER_DATA["email"]


async def test_send_reminders_only_sends_once(client: AsyncClient, db):
    admin_token = await make_admin(client, db)
    _pid, variant_id = await _create_product_and_variant(client, admin_token, name="Once Widget")
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1})
    await client.post("/api/cart/recovery-email", json={"email": "once@example.com"})

    session_id = client.cookies.get("guest_session")
    cart = await _get_cart(db, session_id=session_id)
    cart.updated_at = _idle_cutoff()
    await db.flush()
    await db.commit()

    first = await send_reminders(TestSessionLocal)
    assert first == 1
    second = await send_reminders(TestSessionLocal)
    assert second == 0


async def test_modifying_cart_resets_reminder_flag(client: AsyncClient, db):
    """A cart that was already reminded becomes eligible again once it changes."""
    admin_token = await make_admin(client, db)
    _pid, variant_id = await _create_product_and_variant(client, admin_token, name="Reset Widget", stock=10)
    await client.post("/api/cart/items", json={"variant_id": variant_id, "quantity": 1})

    session_id = client.cookies.get("guest_session")
    cart = await _get_cart(db, session_id=session_id)
    cart.reminder_sent_at = datetime.now(timezone.utc)
    await db.flush()
    await db.commit()

    r = await client.put(f"/api/cart/items/{variant_id}", json={"quantity": 2})
    assert r.status_code == 200

    db.expire_all()
    cart = await _get_cart(db, session_id=session_id)
    assert cart.reminder_sent_at is None
