from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class TaxZoneCreate(BaseModel):
    name: str
    countries: str
    rate_percent: Decimal
    is_active: bool = True


class TaxZoneUpdate(BaseModel):
    name: Optional[str] = None
    countries: Optional[str] = None
    rate_percent: Optional[Decimal] = None
    is_active: Optional[bool] = None


class TaxZoneOut(BaseModel):
    id: str
    name: str
    countries: str
    rate_percent: Decimal
    is_active: bool
    model_config = {"from_attributes": True}


class TaxRateOut(BaseModel):
    zone_name: Optional[str]
    rate_percent: Decimal
    country: str
