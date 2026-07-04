from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sa_update
from fastapi import HTTPException, status
from app.plugins.coupons.models import Coupon, CouponUsage, DiscountType
from app.plugins.coupons.schemas import CouponCreate, CouponUpdate


async def create_coupon(data: CouponCreate, db: AsyncSession) -> Coupon:
    code = data.code.upper().strip()
    existing = await db.execute(select(Coupon).where(Coupon.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Coupon code '{code}' already exists")
    if data.show_on_homepage:
        await db.execute(sa_update(Coupon).values(show_on_homepage=False))
    coupon = Coupon(
        code=code,
        name=data.name,
        description=data.description,
        discount_type=DiscountType(data.discount_type),
        discount_value=data.discount_value,
        min_order_value=data.min_order_value,
        max_uses=data.max_uses,
        expires_at=data.expires_at,
        show_on_homepage=data.show_on_homepage,
        is_active=data.is_active,
    )
    db.add(coupon)
    await db.flush()
    return coupon


async def get_coupon(coupon_id: str, db: AsyncSession) -> Coupon:
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found")
    return coupon


async def list_coupons(db: AsyncSession) -> list[Coupon]:
    result = await db.execute(select(Coupon).order_by(Coupon.created_at.desc()))
    return list(result.scalars().all())


async def update_coupon(coupon_id: str, data: CouponUpdate, db: AsyncSession) -> Coupon:
    coupon = await get_coupon(coupon_id, db)
    updates = data.model_dump(exclude_unset=True)
    if updates.get("show_on_homepage"):
        await db.execute(
            sa_update(Coupon).where(Coupon.id != coupon_id).values(show_on_homepage=False)
        )
    for field, value in updates.items():
        setattr(coupon, field, value)
    await db.flush()
    return coupon


async def delete_coupon(coupon_id: str, db: AsyncSession) -> None:
    coupon = await get_coupon(coupon_id, db)
    await db.delete(coupon)
    await db.flush()


async def validate_coupon(code: str, subtotal: Decimal, db: AsyncSession) -> tuple[Coupon, Decimal]:
    """Return (coupon, discount_amount) or raise HTTPException."""
    result = await db.execute(select(Coupon).where(Coupon.code == code.upper().strip()).with_for_update())
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid coupon code")
    if not coupon.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon is no longer active")
    if coupon.expires_at:
        expires = coupon.expires_at.replace(tzinfo=timezone.utc) if coupon.expires_at.tzinfo is None else coupon.expires_at
        if expires < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon has expired")
    if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon has reached its maximum uses")
    if coupon.min_order_value and subtotal < coupon.min_order_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum order value of {coupon.min_order_value} required for this coupon",
        )

    if coupon.discount_type == DiscountType.percentage:
        discount = (subtotal * coupon.discount_value / Decimal("100")).quantize(Decimal("0.01"))
    else:
        discount = min(coupon.discount_value, subtotal)

    return coupon, discount


async def record_usage(
    coupon: Coupon,
    order_id: str,
    discount_applied: Decimal,
    db: AsyncSession,
    user_id: Optional[str] = None,
) -> None:
    coupon.used_count += 1
    usage = CouponUsage(
        coupon_id=coupon.id,
        user_id=user_id,
        order_id=order_id,
        discount_applied=discount_applied,
    )
    db.add(usage)
    await db.flush()


async def reverse_usage(order_id: str, db: AsyncSession) -> None:
    """Reverse coupon usage for a cancelled order: decrement each coupon's used_count and
    drop the CouponUsage rows, so a cancelled order doesn't permanently burn a coupon use."""
    result = await db.execute(select(CouponUsage).where(CouponUsage.order_id == order_id))
    for usage in list(result.scalars().all()):
        coupon_result = await db.execute(select(Coupon).where(Coupon.id == usage.coupon_id))
        coupon = coupon_result.scalar_one_or_none()
        if coupon and coupon.used_count > 0:
            coupon.used_count -= 1
        await db.delete(usage)
    await db.flush()
