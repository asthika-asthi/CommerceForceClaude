from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.coupons.models import Coupon
from app.plugins.coupons.schemas import CouponCreate, CouponUpdate, CouponOut, CouponRead, CouponValidateOut
from app.plugins.coupons import service

router = APIRouter()


@router.get("", response_model=list[CouponOut], dependencies=[Depends(require_admin())])
async def list_coupons(db: AsyncSession = Depends(get_db)):
    return await service.list_coupons(db)


@router.post("", response_model=CouponOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin())])
async def create_coupon(data: CouponCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_coupon(data, db)


@router.get("/featured", response_model=Optional[CouponRead])
async def get_featured_coupon(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Coupon)
        .where(Coupon.show_on_homepage == True)
        .where(Coupon.is_active == True)
        .where(or_(Coupon.expires_at == None, Coupon.expires_at > now))
        .limit(1)
    )
    return result.scalar_one_or_none()


@router.put("/{coupon_id}", response_model=CouponOut, dependencies=[Depends(require_admin())])
async def update_coupon(coupon_id: str, data: CouponUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_coupon(coupon_id, data, db)


@router.delete("/{coupon_id}", status_code=204, dependencies=[Depends(require_admin())])
async def delete_coupon(coupon_id: str, db: AsyncSession = Depends(get_db)):
    await service.delete_coupon(coupon_id, db)


@router.get("/validate", response_model=CouponValidateOut)
async def validate_coupon(
    code: str = Query(...),
    subtotal: Decimal = Query(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        coupon, discount = await service.validate_coupon(code, subtotal, db)
        return CouponValidateOut(
            valid=True,
            discount_type=coupon.discount_type,
            discount_value=discount,
            message=f"{coupon.name} applied",
        )
    except HTTPException as e:
        return CouponValidateOut(valid=False, message=e.detail)
