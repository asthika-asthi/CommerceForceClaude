from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.branding.schemas import BrandingConfigOut, BrandingConfigUpdate
from app.plugins.branding import service

router = APIRouter()


@router.get("", response_model=BrandingConfigOut)
async def get_branding(db: AsyncSession = Depends(get_db)):
    return await service.get_config(db)


@router.put("", response_model=BrandingConfigOut, dependencies=[Depends(require_admin())])
async def update_branding(data: BrandingConfigUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_config(data, db)
