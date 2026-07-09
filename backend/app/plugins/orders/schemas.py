from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel
from app.plugins.orders.models import OrderStatus, PaymentMethod, PaymentStatus


class OrderItemOut(BaseModel):
    id: str
    product_id: Optional[str] = None
    variant_id: Optional[str] = None
    variant_label: Optional[str] = None
    product_name: str
    product_sku: str
    unit_price: Decimal
    quantity: int
    subtotal: Decimal
    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: str
    order_number: str
    user_id: Optional[str] = None
    guest_email: Optional[str] = None
    status: OrderStatus
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    shipping_cost: Decimal
    total: Decimal
    shipping_address: Optional[str] = None
    notes: Optional[str] = None
    tracking_number: Optional[str] = None
    shipped_at: Optional[datetime] = None
    items: List[OrderItemOut] = []
    model_config = {"from_attributes": True}


class OrderListOut(BaseModel):
    id: str
    order_number: str
    status: OrderStatus
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    total: Decimal
    item_count: int
    model_config = {"from_attributes": True}


class TrackOrderRequest(BaseModel):
    order_number: str
    email: str


class UpdateStatusRequest(BaseModel):
    status: OrderStatus


class FulfilRequest(BaseModel):
    tracking_number: Optional[str] = None
