from decimal import Decimal
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.plugins.shipping.models import ShippingZone
from app.plugins.shipping.schemas import ShippingZoneCreate, ShippingZoneUpdate
import uuid


async def get_rate(country: str, db: AsyncSession) -> tuple[Optional[str], Decimal]:
    """Return (zone_name, flat_rate) for the given ISO country code.

    Matching priority:
    1. Zone whose countries list includes the exact country code
    2. Catch-all zone whose countries == "*"
    3. (0.00, None) if no zone matches
    """
    result = await db.execute(
        select(ShippingZone).where(ShippingZone.is_active == True)
    )
    zones = result.scalars().all()

    country_upper = country.strip().upper()
    catch_all: Optional[ShippingZone] = None

    for zone in zones:
        codes = [c.strip().upper() for c in zone.countries.split(",")]
        if "*" in codes:
            catch_all = zone
        elif country_upper in codes:
            return zone.name, zone.flat_rate

    if catch_all:
        return catch_all.name, catch_all.flat_rate

    return None, Decimal("0")


async def list_zones(db: AsyncSession) -> list[ShippingZone]:
    result = await db.execute(select(ShippingZone).order_by(ShippingZone.name))
    return list(result.scalars().all())


async def create_zone(data: ShippingZoneCreate, db: AsyncSession) -> ShippingZone:
    zone = ShippingZone(
        id=str(uuid.uuid4()),
        name=data.name,
        countries=data.countries.upper(),
        flat_rate=data.flat_rate,
        is_active=data.is_active,
    )
    db.add(zone)
    await db.flush()
    return zone


async def update_zone(zone_id: str, data: ShippingZoneUpdate, db: AsyncSession) -> ShippingZone:
    result = await db.execute(select(ShippingZone).where(ShippingZone.id == zone_id))
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Shipping zone not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(zone, field, value)
    await db.flush()
    return zone


async def delete_zone(zone_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(ShippingZone).where(ShippingZone.id == zone_id))
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Shipping zone not found")
    await db.delete(zone)
    await db.flush()
