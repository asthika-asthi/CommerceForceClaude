"""Abandoned-cart recovery — finds idle carts and emails a one-time reminder.

Runs on an in-process APScheduler job (registered in app/main.py's lifespan)
rather than a Celery worker: nothing else in this codebase has a task queue
wired up yet, so this is the smallest infrastructure addition that gets the
job done. If a real task queue is ever introduced project-wide, this function
can be moved to a task with no change to its logic.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Callable
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.plugins.cart.models import Cart
from app.plugins.products.models import Product, ProductVariant
from app.shared.email import send_email
from app.shared.currency import format_money

logger = logging.getLogger(__name__)


async def _resolve_email(cart: Cart, db: AsyncSession) -> str | None:
    if cart.user_id:
        from app.plugins.auth.models import User
        result = await db.execute(select(User.email).where(User.id == cart.user_id))
        return result.scalar_one_or_none()
    return cart.recovery_email


async def _build_reminder_body(cart: Cart, db: AsyncSession) -> str:
    lines = []
    for item in cart.items:
        variant_result = await db.execute(select(ProductVariant).where(ProductVariant.id == item.variant_id))
        variant = variant_result.scalar_one_or_none()
        if not variant:
            continue
        product_result = await db.execute(select(Product).where(Product.id == variant.product_id))
        product = product_result.scalar_one_or_none()
        if not product:
            continue
        unit_price = product.effective_price + (variant.price_adjustment or 0)
        lines.append(f"  {product.name} x{item.quantity}  {format_money(float(unit_price) * item.quantity)}")

    items_text = "\n".join(lines) if lines else "  (items no longer available)"
    return (
        "You left something in your cart!\n\n"
        f"{items_text}\n\n"
        f"Finish checking out: {settings.STOREFRONT_URL}/cart\n"
    )


async def send_reminders(session_factory: Callable[[], AsyncSession] = AsyncSessionLocal) -> int:
    """Email every qualifying idle cart once. Returns the number of reminders sent.

    Runs outside any request context (called by the scheduler job), so it opens
    its own session rather than depending on FastAPI's get_db. `session_factory`
    is overridable so tests can point it at the isolated test database instead
    of the real one.

    Note: ABANDONED_CART_ENABLED gates whether the *scheduler* registers this as
    a periodic job (see app/main.py) — it is deliberately not checked again here,
    so the function still does its job when called directly (e.g. from tests).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.ABANDONED_CART_DELAY_HOURS)
    sent = 0

    async with session_factory() as db:
        result = await db.execute(
            select(Cart)
            .where(Cart.reminder_sent_at.is_(None))
            .where(Cart.updated_at < cutoff)
            .options(selectinload(Cart.items))
        )
        carts = result.scalars().all()

        for cart in carts:
            if not cart.items:
                continue
            email = await _resolve_email(cart, db)
            if not email:
                continue
            body = await _build_reminder_body(cart, db)
            await send_email(email, "You left something in your cart", body, db)
            cart.reminder_sent_at = datetime.now(timezone.utc)
            sent += 1

        await db.commit()

    if sent:
        logger.info("Abandoned-cart: sent %d reminder(s)", sent)
    return sent
