from decimal import Decimal
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class DiscountRuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    discount_type: str  # "percentage" or "fixed"
    discount_value: Decimal
    min_order_value: Optional[Decimal] = None
    is_active: bool = True
    priority: int = 0


class DiscountRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[Decimal] = None
    min_order_value: Optional[Decimal] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None


class DiscountRuleOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    discount_type: str
    discount_value: Decimal
    min_order_value: Optional[Decimal] = None
    is_active: bool
    priority: int
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}
