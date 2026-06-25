from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    product_id: str
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = None
    body: Optional[str] = None


class ReviewOut(BaseModel):
    id: str
    product_id: str
    user_id: str
    rating: int
    title: Optional[str] = None
    body: Optional[str] = None
    is_approved: bool
    reviewer_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    title: Optional[str] = None
    body: Optional[str] = None


class ReviewSummary(BaseModel):
    average_rating: float
    total_reviews: int
