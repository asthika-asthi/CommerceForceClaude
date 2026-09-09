from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_superadmin
from app.plugins.branding.schemas import BrandingConfigOut, BrandingConfigUpdate
from app.plugins.branding import service

router = APIRouter()


@router.get("", response_model=BrandingConfigOut)
async def get_branding(db: AsyncSession = Depends(get_db)):
    return await service.get_config(db)


# Superadmin-only: branding controls the whole storefront look, so a plain admin
# must not be able to change it (matches the Page Content editor). GET stays
# public — the storefront reads it on every request.
@router.put("", response_model=BrandingConfigOut, dependencies=[Depends(require_superadmin())])
async def update_branding(data: BrandingConfigUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_config(data, db)
