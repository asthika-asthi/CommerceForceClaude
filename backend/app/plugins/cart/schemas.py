from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel


class CartItemOut(BaseModel):
    id: str
    product_id: str
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
    product_id: str
    quantity: int = 1


class UpdateItemRequest(BaseModel):
    quantity: int
