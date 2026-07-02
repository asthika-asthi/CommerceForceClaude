from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class CreditAccountCreate(BaseModel):
    user_id: str
    credit_limit: Decimal = Field(..., ge=0)
    notes: Optional[str] = None


class CreditAccountUpdate(BaseModel):
    credit_limit: Optional[Decimal] = Field(None, ge=0)
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class CreditAccountOut(BaseModel):
    id: str
    user_id: str
    credit_limit: Decimal
    used_credit: Decimal
    available_credit: Decimal
    is_active: bool
    notes: Optional[str] = None
    model_config = {"from_attributes": True}
