from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class ShippingZoneCreate(BaseModel):
    name: str
    countries: str
    flat_rate: Decimal
    is_active: bool = True


class ShippingZoneUpdate(BaseModel):
    name: Optional[str] = None
    countries: Optional[str] = None
    flat_rate: Optional[Decimal] = None
    is_active: Optional[bool] = None


class ShippingZoneOut(BaseModel):
    id: str
    name: str
    countries: str
    flat_rate: Decimal
    is_active: bool
    model_config = {"from_attributes": True}


class ShippingRateOut(BaseModel):
    zone_name: Optional[str]
    flat_rate: Decimal
    country: str


class ShippingBandIn(BaseModel):
    min_order_value: Decimal = Field(..., ge=0)
    charge: Decimal = Field(..., ge=0)


class ShippingBandsUpdate(BaseModel):
    """Full replacement list of bands. Validated in the service."""
    bands: list[ShippingBandIn] = Field(..., min_length=1)


class ShippingBandOut(BaseModel):
    min_order_value: Decimal
    charge: Decimal
    model_config = {"from_attributes": True}


class ShippingBandsOut(BaseModel):
    bands: list[ShippingBandOut]
    # Lowest order value that ships free, or None if no band is free.
    free_threshold: Optional[Decimal] = None
    currency: str


class ShippingSettingsOut(BaseModel):
    default_weight_kg: Decimal
    model_config = {"from_attributes": True}


class ShippingSettingsUpdate(BaseModel):
    default_weight_kg: Decimal = Field(..., ge=0)
