from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.coupons.schemas import CouponCreate, CouponUpdate, CouponOut, CouponValidateOut
from app.plugins.coupons import service

router = APIRouter()


@router.get("", response_model=list[CouponOut], dependencies=[Depends(require_admin())])
async def list_coupons(db: AsyncSession = Depends(get_db)):
    return await service.list_coupons(db)


@router.post("", response_model=CouponOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin())])
async def create_coupon(data: CouponCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_coupon(data, db)


@router.put("/{coupon_id}", response_model=CouponOut, dependencies=[Depends(require_admin())])
async def update_coupon(coupon_id: str, data: CouponUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_coupon(coupon_id, data, db)


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
