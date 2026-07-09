from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr, model_validator


class CartItemOut(BaseModel):
    id: str
    variant_id: str
    product_id: str
    variant_label: str = ""
    product_name: str
    product_sku: str
    product_slug: str
    unit_price: Decimal
    quantity: int
    line_total: Decimal
    primary_image: Optional[str] = None
    in_stock: bool
    stock_quantity: int


class CartOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    items: List[CartItemOut] = []
    subtotal: Decimal
    item_count: int


class AddItemRequest(BaseModel):
    # Either variant_id (specific variant, from the product detail page) or
    # product_id (quick-add from a listing — resolves the product's default variant).
    variant_id: Optional[str] = None
    product_id: Optional[str] = None
    quantity: int = 1

    @model_validator(mode="after")
    def require_one_id(self) -> "AddItemRequest":
        if not self.variant_id and not self.product_id:
            raise ValueError("Either variant_id or product_id is required")
        return self


class UpdateItemRequest(BaseModel):
    quantity: int


class RecoveryEmailRequest(BaseModel):
    email: EmailStr
