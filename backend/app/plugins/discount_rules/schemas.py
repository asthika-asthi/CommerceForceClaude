from decimal import Decimal
from typing import Literal, Optional
from datetime import datetime
from pydantic import BaseModel, field_validator


class DiscountRuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    discount_type: Literal["percentage", "fixed"]
    discount_value: Decimal
    min_order_value: Optional[Decimal] = None
    is_active: bool = True
    priority: int = 0

    @field_validator("discount_value")
    @classmethod
    def value_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("discount_value must be greater than 0")
        return v

    @field_validator("min_order_value")
    @classmethod
    def min_order_non_negative(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v < 0:
            raise ValueError("min_order_value cannot be negative")
        return v


class DiscountRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[Literal["percentage", "fixed"]] = None
    discount_value: Optional[Decimal] = None
    min_order_value: Optional[Decimal] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None

    @field_validator("discount_value")
    @classmethod
    def value_positive(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("discount_value must be greater than 0")
        return v


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
