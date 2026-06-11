from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


class ProductImageOut(BaseModel):
    id: str
    url: str
    alt_text: Optional[str] = None
    is_primary: bool
    sort_order: int
    model_config = {"from_attributes": True}


class ProductImageCreate(BaseModel):
    url: str
    alt_text: Optional[str] = None
    is_primary: bool = False
    sort_order: int = 0


class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    price: Decimal = Field(..., ge=0)
    sale_price: Optional[Decimal] = Field(None, ge=0)
    is_on_sale: bool = False
    stock_quantity: int = 0
    low_stock_threshold: int = 10
    is_featured: bool = False
    weight: Optional[Decimal] = Field(None, ge=0)
    tags: Optional[str] = None
    images: List[ProductImageCreate] = []


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    price: Optional[Decimal] = None
    sale_price: Optional[Decimal] = None
    is_on_sale: Optional[bool] = None
    stock_quantity: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    weight: Optional[Decimal] = None
    tags: Optional[str] = None


class ProductOut(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    sku: str
    category_id: Optional[str] = None
    price: Decimal
    sale_price: Optional[Decimal] = None
    is_on_sale: bool
    effective_price: Decimal
    stock_quantity: int
    in_stock: bool
    is_active: bool
    is_featured: bool
    weight: Optional[Decimal] = None
    tags: Optional[str] = None
    images: List[ProductImageOut] = []
    model_config = {"from_attributes": True}


class ProductListOut(BaseModel):
    id: str
    name: str
    slug: str
    sku: str
    category_id: Optional[str] = None
    price: Decimal
    sale_price: Optional[Decimal] = None
    is_on_sale: bool
    effective_price: Decimal
    stock_quantity: int
    in_stock: bool
    is_active: bool
    is_featured: bool
    primary_image: Optional[str] = None
    model_config = {"from_attributes": True}


class CsvImportError(BaseModel):
    row: int
    error: str


class CsvImportResult(BaseModel):
    created: int
    errors: list[CsvImportError]
