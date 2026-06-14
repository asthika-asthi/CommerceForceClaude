from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel as PydanticBase
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.promotions.models import PromotionBanner

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class PromotionBannerCreate(PydanticBase):
    headline: str
    body: str
    cta_text: str
    cta_url: str
    image_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True


class PromotionBannerUpdate(PydanticBase):
    headline: Optional[str] = None
    body: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    image_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class PromotionBannerRead(PydanticBase):
    id: int
    headline: str
    body: str
    cta_text: str
    cta_url: str
    image_url: Optional[str]
    expires_at: Optional[datetime]
    is_active: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Admin endpoints (auth required)
# ---------------------------------------------------------------------------

@router.get("", response_model=list[PromotionBannerRead], dependencies=[Depends(require_admin())])
async def list_promotions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromotionBanner).order_by(PromotionBanner.id.desc()))
    return result.scalars().all()


@router.post("", response_model=PromotionBannerRead, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin())])
async def create_promotion(data: PromotionBannerCreate, db: AsyncSession = Depends(get_db)):
    banner = PromotionBanner(**data.model_dump())
    db.add(banner)
    await db.commit()
    await db.refresh(banner)
    return banner


@router.put("/{id}", response_model=PromotionBannerRead, dependencies=[Depends(require_admin())])
async def update_promotion(id: int, data: PromotionBannerUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromotionBanner).where(PromotionBanner.id == id))
    banner = result.scalar_one_or_none()
    if banner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(banner, field, value)
    await db.commit()
    await db.refresh(banner)
    return banner


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin())])
async def delete_promotion(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromotionBanner).where(PromotionBanner.id == id))
    banner = result.scalar_one_or_none()
    if banner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found")
    await db.delete(banner)
    await db.commit()


# ---------------------------------------------------------------------------
# Public storefront endpoint (no auth)
# ---------------------------------------------------------------------------

@router.get("/active", response_model=Optional[PromotionBannerRead])
async def get_active_promotion(db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    result = await db.execute(
        select(PromotionBanner)
        .where(PromotionBanner.is_active == True)
        .where(or_(PromotionBanner.expires_at == None, PromotionBanner.expires_at > now))
        .order_by(PromotionBanner.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()
