from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


class LoyaltyConfigOut(BaseModel):
    points_per_dollar: Decimal
    redemption_rate: Decimal
    min_redemption: int
    is_active: bool
    model_config = {"from_attributes": True}


class LoyaltyConfigUpdate(BaseModel):
    points_per_dollar: Optional[Decimal] = Field(None, ge=0)
    redemption_rate: Optional[Decimal] = Field(None, ge=0)
    min_redemption: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class LoyaltyAccountOut(BaseModel):
    id: str
    user_id: str
    points_balance: int
    total_earned: int
    total_redeemed: int
    model_config = {"from_attributes": True}


class LoyaltyTransactionOut(BaseModel):
    id: str
    user_id: str
    order_id: Optional[str] = None
    transaction_type: str
    points: int
    description: str
    model_config = {"from_attributes": True}


class ManualAdjustRequest(BaseModel):
    user_id: str
    points: int  # positive = add, negative = subtract
    description: str
