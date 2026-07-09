from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.plugins.tax.models import TaxZone
from app.plugins.tax.schemas import TaxZoneCreate, TaxZoneUpdate
import uuid


async def get_rate(country: str, db: AsyncSession) -> tuple[Optional[str], Decimal]:
    """Return (zone_name, rate_percent) for the given ISO country code.

    Matching priority:
    1. Zone whose countries list includes the exact country code
    2. Catch-all zone whose countries == "*"
    3. (None, 0.00) if no zone matches
    """
    result = await db.execute(
        select(TaxZone).where(TaxZone.is_active == True)
    )
    zones = result.scalars().all()

    country_upper = country.strip().upper()
    catch_all: Optional[TaxZone] = None

    for zone in zones:
        codes = [c.strip().upper() for c in zone.countries.split(",")]
        if "*" in codes:
            catch_all = zone
        elif country_upper in codes:
            return zone.name, zone.rate_percent

    if catch_all:
        return catch_all.name, catch_all.rate_percent

    return None, Decimal("0")


async def calculate_tax(taxable_amount: Decimal, country: Optional[str], db: AsyncSession) -> Decimal:
    """Compute the tax due on `taxable_amount` for the given delivery country.

    Taxable base is the caller's responsibility (checkout passes subtotal minus
    discount — shipping is not taxed). Returns 0 when no country is given or no
    zone matches.
    """
    if not country:
        return Decimal("0")
    _zone_name, rate_percent = await get_rate(country, db)
    if rate_percent == 0:
        return Decimal("0")
    return (taxable_amount * rate_percent / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def list_zones(db: AsyncSession) -> list[TaxZone]:
    result = await db.execute(select(TaxZone).order_by(TaxZone.name))
    return list(result.scalars().all())


async def create_zone(data: TaxZoneCreate, db: AsyncSession) -> TaxZone:
    zone = TaxZone(
        id=str(uuid.uuid4()),
        name=data.name,
        countries=data.countries.upper(),
        rate_percent=data.rate_percent,
        is_active=data.is_active,
    )
    db.add(zone)
    await db.flush()
    return zone


async def update_zone(zone_id: str, data: TaxZoneUpdate, db: AsyncSession) -> TaxZone:
    result = await db.execute(select(TaxZone).where(TaxZone.id == zone_id))
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Tax zone not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(zone, field, value)
    await db.flush()
    return zone


async def delete_zone(zone_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(TaxZone).where(TaxZone.id == zone_id))
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Tax zone not found")
    await db.delete(zone)
    await db.flush()
