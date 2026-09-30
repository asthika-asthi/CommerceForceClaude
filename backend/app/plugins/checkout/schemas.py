import re
from decimal import Decimal
from typing import Optional, List
from email_validator import validate_email, EmailNotValidError
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from app.core.config import settings
from app.plugins.orders.models import PaymentMethod

UK_POSTCODE_RE = re.compile(r"^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$")
GENERIC_POSTCODE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 \-]*$")


class CheckoutItem(BaseModel):
    product_id: str
    # ge=1: a non-positive quantity would produce a negative line total and let a
    # buyer offset other items to manipulate the order total. Never allow it.
    quantity: int = Field(..., ge=1)
    variant_id: Optional[str] = None  # optional; defaults to the product's default variant


class CheckoutRequest(BaseModel):
    payment_method: PaymentMethod = PaymentMethod.cash
    shipping_address: Optional[str] = None
    delivery_country: Optional[str] = None  # ISO 3166-1 alpha-2, e.g. "GB"
    notes: Optional[str] = None
    guest_email: Optional[EmailStr] = None
    guest_name: Optional[str] = None
    guest_postcode: Optional[str] = None
    use_cart: bool = True
    items: Optional[List[CheckoutItem]] = None
    coupon_code: Optional[str] = None
    redeem_points: int = Field(0, ge=0)

    @field_validator("guest_email")
    @classmethod
    def guest_email_deliverable(cls, v: Optional[EmailStr]) -> Optional[EmailStr]:
        if v is None or not settings.EMAIL_CHECK_DELIVERABILITY:
            return v
        try:
            validate_email(str(v), check_deliverability=True, timeout=5)
        except EmailNotValidError:
            raise ValueError("We couldn't find a mail server for this email's domain — please check it's correct")
        return v

    @field_validator("guest_name")
    @classmethod
    def guest_name_full(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Must not be blank")
        if len(v.split()) < 2:
            raise ValueError("Enter your full name (first and last)")
        return v

    @model_validator(mode="after")
    def guest_postcode_format(self) -> "CheckoutRequest":
        if self.guest_postcode is None:
            return self
        pc = self.guest_postcode.strip()
        if not pc:
            raise ValueError("Postcode must not be blank")
        if self.delivery_country and self.delivery_country.strip().upper() == "GB":
            if not UK_POSTCODE_RE.match(pc):
                raise ValueError("Enter a valid UK postcode")
        else:
            if not (2 <= len(pc) <= 12) or not GENERIC_POSTCODE_RE.match(pc):
                raise ValueError("Enter a valid postcode")
        self.guest_postcode = pc
        return self


class PaymentMethodOut(BaseModel):
    key: str
    label: str
    description: str


class ShippingQuoteRequest(BaseModel):
    delivery_country: Optional[str] = Field(None, min_length=2, max_length=2)
    # Discounts change the order value the delivery band is chosen on.
    coupon_code: Optional[str] = None
    redeem_points: int = Field(0, ge=0)


class ShippingQuoteOut(BaseModel):
    zone_name: Optional[str] = None
    cost: Decimal = Decimal("0")
    weight_kg: Optional[Decimal] = None
    # Goods after discounts, ex VAT: what the band was chosen on.
    order_value: Decimal = Decimal("0")
    # Nearest cheaper band and how much more to spend to reach it.
    next_threshold: Optional[Decimal] = None
    amount_to_next_band: Optional[Decimal] = None
    # What delivery would cost in that cheaper band (0 = free).
    next_charge: Optional[Decimal] = None


class CheckoutSummary(BaseModel):
    order_id: str
    order_number: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal = Decimal("0")
    shipping_cost: Decimal = Decimal("0")
    total: Decimal
    payment_method: PaymentMethod
    payment_status: str
    status: str
    client_secret: Optional[str] = None
