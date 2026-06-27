from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


class CouponCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str
    description: Optional[str] = None
    discount_type: str  # "percentage" or "fixed"
    discount_value: Decimal = Field(..., ge=0)
    min_order_value: Optional[Decimal] = Field(None, ge=0)
    max_uses: Optional[int] = Field(None, ge=1)
    expires_at: Optional[datetime] = None
    show_on_homepage: bool = False
    is_active: bool = True


class CouponUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    discount_value: Optional[Decimal] = Field(None, ge=0)
    min_order_value: Optional[Decimal] = Field(None, ge=0)
    max_uses: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None
    show_on_homepage: Optional[bool] = None


class CouponOut(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str] = None
    discount_type: str
    discount_value: Decimal
    min_order_value: Optional[Decimal] = None
    max_uses: Optional[int] = None
    used_count: int
    is_active: bool
    expires_at: Optional[datetime] = None
    show_on_homepage: bool = False
    model_config = {"from_attributes": True}


# Alias used by the /featured endpoint
CouponRead = CouponOut


class CouponValidateOut(BaseModel):
    valid: bool
    discount_type: Optional[str] = None
    discount_value: Optional[Decimal] = None
    message: str
