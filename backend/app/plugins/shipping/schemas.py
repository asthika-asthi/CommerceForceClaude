from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


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
