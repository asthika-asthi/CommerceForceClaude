from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


class RFQItemCreate(BaseModel):
    product_id: Optional[str] = None
    product_name: str
    product_sku: Optional[str] = None
    requested_quantity: int = Field(..., ge=1)
    notes: Optional[str] = None


class RFQCreate(BaseModel):
    notes: Optional[str] = None
    items: List[RFQItemCreate] = Field(..., min_length=1)


class RFQItemQuote(BaseModel):
    rfq_item_id: str
    quoted_price: Decimal = Field(..., ge=0)


class RFQQuoteRequest(BaseModel):
    admin_notes: Optional[str] = None
    valid_until: Optional[datetime] = None
    item_quotes: List[RFQItemQuote] = Field(..., min_length=1)


class RFQItemOut(BaseModel):
    id: str
    product_id: Optional[str] = None
    product_name: str
    product_sku: Optional[str] = None
    requested_quantity: int
    quoted_price: Optional[Decimal] = None
    notes: Optional[str] = None
    model_config = {"from_attributes": True}


class RFQOut(BaseModel):
    id: str
    rfq_number: str
    user_id: str
    status: str
    notes: Optional[str] = None
    admin_notes: Optional[str] = None
    valid_until: Optional[datetime] = None
    created_at: Optional[datetime] = None
    items: List[RFQItemOut] = []
    model_config = {"from_attributes": True}


class RFQPageOut(BaseModel):
    items: List[RFQOut]
    total: int
    page: int
    page_size: int
    pages: int
