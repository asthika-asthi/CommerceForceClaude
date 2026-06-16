from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from app.plugins.orders.models import PaymentMethod


class CheckoutItem(BaseModel):
    product_id: str
    quantity: int


class CheckoutRequest(BaseModel):
    payment_method: PaymentMethod = PaymentMethod.cash
    shipping_address: Optional[str] = None
    notes: Optional[str] = None
    guest_email: Optional[EmailStr] = None
    use_cart: bool = True
    items: Optional[List[CheckoutItem]] = None
    coupon_code: Optional[str] = None
    redeem_points: int = 0


class PaymentMethodOut(BaseModel):
    key: str
    label: str
    description: str


class CheckoutSummary(BaseModel):
    order_id: str
    order_number: str
    subtotal: Decimal
    discount_amount: Decimal
    total: Decimal
    payment_method: PaymentMethod
    payment_status: str
    status: str
    client_secret: Optional[str] = None
