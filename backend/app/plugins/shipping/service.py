from dataclasses import dataclass
from decimal import Decimal
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.plugins.shipping.models import ShippingBand, ShippingSettings, ShippingZone
from app.plugins.shipping.schemas import (
    ShippingBandsUpdate, ShippingSettingsUpdate, ShippingZoneCreate, ShippingZoneUpdate,
)
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


@dataclass
class Quote:
    zone_name: Optional[str]
    cost: Decimal
    # Nearest higher band that would cost less, and how much more to spend to reach it.
    next_threshold: Optional[Decimal] = None
    amount_to_next_band: Optional[Decimal] = None
    next_charge: Optional[Decimal] = None


async def list_bands(db: AsyncSession) -> list[ShippingBand]:
    result = await db.execute(select(ShippingBand).order_by(ShippingBand.min_order_value))
    return list(result.scalars().all())


def band_for(order_value: Decimal, bands: list[ShippingBand]) -> Optional[ShippingBand]:
    """The band an order of ``order_value`` falls in (highest min not above it)."""
    match: Optional[ShippingBand] = None
    for band in bands:  # ascending by min_order_value
        if band.min_order_value <= order_value:
            match = band
    return match


async def replace_bands(data: ShippingBandsUpdate, db: AsyncSession) -> list[ShippingBand]:
    """Replace the whole band list. Exactly one band must start at 0 and mins must be unique."""
    mins = [b.min_order_value for b in data.bands]
    if len(set(mins)) != len(mins):
        raise HTTPException(status_code=422, detail="Each band must start at a different order value")
    if min(mins) != 0:
        raise HTTPException(status_code=422, detail="The first band must start at £0 so every order has a charge")
    for existing in await list_bands(db):
        await db.delete(existing)
    await db.flush()
    for b in sorted(data.bands, key=lambda x: x.min_order_value):
        db.add(ShippingBand(id=str(uuid.uuid4()), min_order_value=b.min_order_value, charge=b.charge))
    await db.flush()
    return await list_bands(db)


async def quote(country: Optional[str], weight_kg: Decimal, order_value: Decimal, db: AsyncSession) -> Quote:
    """Delivery charge for an order worth ``order_value`` (goods after discounts,
    ex VAT) going to ``country``.

    This is the single entry point checkout uses to price delivery. The charge
    comes from the order-value band and always applies: bands are global, so it
    does not depend on a zone existing or on a country being supplied (otherwise
    a store with no zones, or a request that omits the country, would ship free).
    The country's zone, if any, is only reported as a label. ``weight_kg`` is not
    used for pricing yet; a weight-based or live-carrier provider (Royal Mail etc.)
    replaces the body of this function without checkout or the storefront changing.
    """
    zone_name: Optional[str] = None
    if country:
        zone_name, _flat_rate = await get_rate(country, db)
    bands = await list_bands(db)
    band = band_for(order_value, bands)
    if band is None:
        return Quote(zone_name, Decimal("0"))
    cheaper = [b for b in bands if b.min_order_value > order_value and b.charge < band.charge]
    if not cheaper:
        return Quote(zone_name, band.charge)
    nxt = cheaper[0]
    return Quote(zone_name, band.charge, nxt.min_order_value, nxt.min_order_value - order_value, nxt.charge)


async def get_settings(db: AsyncSession) -> ShippingSettings:
    result = await db.execute(select(ShippingSettings))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = ShippingSettings(default_weight_kg=Decimal("1.000"))
        db.add(settings)
        await db.flush()
    return settings


async def update_settings(data: ShippingSettingsUpdate, db: AsyncSession) -> ShippingSettings:
    settings = await get_settings(db)
    settings.default_weight_kg = data.default_weight_kg
    await db.flush()
    return settings


async def parcel_weight(lines: list[tuple[Optional[Decimal], int]], db: AsyncSession) -> Decimal:
    """Total parcel weight in kg for (item weight, quantity) lines.

    An item with no weight (None) counts as the store's default weight.
    """
    default: Optional[Decimal] = None
    total = Decimal("0")
    for weight, quantity in lines:
        if weight is None:
            if default is None:
                default = (await get_settings(db)).default_weight_kg
            weight = default
        total += Decimal(weight) * quantity
    return total.quantize(Decimal("0.001"))


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
