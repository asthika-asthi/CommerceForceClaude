from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.tax import service
from app.plugins.tax.schemas import TaxZoneCreate, TaxZoneUpdate, TaxZoneOut, TaxRateOut

router = APIRouter()


@router.get("/zones", response_model=list[TaxZoneOut], dependencies=[Depends(require_admin())])
async def list_zones(db: AsyncSession = Depends(get_db)):
    return await service.list_zones(db)


@router.post("/zones", response_model=TaxZoneOut, status_code=201, dependencies=[Depends(require_admin())])
async def create_zone(data: TaxZoneCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_zone(data, db)


@router.put("/zones/{zone_id}", response_model=TaxZoneOut, dependencies=[Depends(require_admin())])
async def update_zone(zone_id: str, data: TaxZoneUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_zone(zone_id, data, db)


@router.delete("/zones/{zone_id}", status_code=204, dependencies=[Depends(require_admin())])
async def delete_zone(zone_id: str, db: AsyncSession = Depends(get_db)):
    await service.delete_zone(zone_id, db)


@router.get("/rate", response_model=TaxRateOut)
async def get_rate(country: str = Query(..., min_length=2, max_length=2), db: AsyncSession = Depends(get_db)):
    zone_name, rate_percent = await service.get_rate(country, db)
    return TaxRateOut(zone_name=zone_name, rate_percent=rate_percent, country=country.upper())
