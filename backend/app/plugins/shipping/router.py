from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.shipping import service
from app.plugins.shipping.schemas import (
    ShippingBandOut, ShippingBandsOut, ShippingBandsUpdate, ShippingRateOut, ShippingSettingsOut,
    ShippingSettingsUpdate, ShippingZoneCreate, ShippingZoneOut, ShippingZoneUpdate,
)

router = APIRouter()


@router.get("/zones", response_model=list[ShippingZoneOut], dependencies=[Depends(require_admin())])
async def list_zones(db: AsyncSession = Depends(get_db)):
    return await service.list_zones(db)


@router.post("/zones", response_model=ShippingZoneOut, status_code=201, dependencies=[Depends(require_admin())])
async def create_zone(data: ShippingZoneCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_zone(data, db)


@router.put("/zones/{zone_id}", response_model=ShippingZoneOut, dependencies=[Depends(require_admin())])
async def update_zone(zone_id: str, data: ShippingZoneUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_zone(zone_id, data, db)


@router.delete("/zones/{zone_id}", status_code=204, dependencies=[Depends(require_admin())])
async def delete_zone(zone_id: str, db: AsyncSession = Depends(get_db)):
    await service.delete_zone(zone_id, db)


@router.get("/rate", response_model=ShippingRateOut)
async def get_rate(country: str = Query(..., min_length=2, max_length=2), db: AsyncSession = Depends(get_db)):
    zone_name, flat_rate = await service.get_rate(country, db)
    return ShippingRateOut(zone_name=zone_name, flat_rate=flat_rate, country=country.upper())


@router.get("/bands", response_model=ShippingBandsOut)
async def get_bands(db: AsyncSession = Depends(get_db)):
    """Public: the storefront builds its delivery copy from these."""
    return _bands_out(await service.list_bands(db))


@router.put("/bands", response_model=ShippingBandsOut, dependencies=[Depends(require_admin())])
async def replace_bands(data: ShippingBandsUpdate, db: AsyncSession = Depends(get_db)):
    return _bands_out(await service.replace_bands(data, db))


def _bands_out(bands) -> ShippingBandsOut:
    free = [b.min_order_value for b in bands if b.charge == 0]
    return ShippingBandsOut(
        bands=[ShippingBandOut.model_validate(b) for b in bands],
        free_threshold=min(free) if free else None,
        currency=settings.CURRENCY_CODE,
    )


@router.get("/settings", response_model=ShippingSettingsOut, dependencies=[Depends(require_admin())])
async def get_settings(db: AsyncSession = Depends(get_db)):
    return await service.get_settings(db)


@router.put("/settings", response_model=ShippingSettingsOut, dependencies=[Depends(require_admin())])
async def update_settings(data: ShippingSettingsUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_settings(data, db)
