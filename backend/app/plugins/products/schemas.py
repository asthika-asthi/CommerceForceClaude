from __future__ import annotations

from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, model_validator


class ProductImageOut(BaseModel):
    id: str
    url: str
    alt_text: Optional[str] = None
    is_primary: bool
    sort_order: int
    variant_id: Optional[str] = None
    model_config = {"from_attributes": True}


class ProductImageCreate(BaseModel):
    url: str
    alt_text: Optional[str] = None
    is_primary: bool = False
    sort_order: int = 0
    variant_id: Optional[str] = None


class ProductImageUpdate(BaseModel):
    variant_id: Optional[str] = None
    alt_text: Optional[str] = None
    is_primary: Optional[bool] = None


class ImageSortItem(BaseModel):
    id: str
    sort_order: int


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
    barcode: Optional[str] = Field(None, max_length=100)
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
    barcode: Optional[str] = Field(None, max_length=100)


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
    barcode: Optional[str] = None
    images: List[ProductImageOut] = []
    primary_image: Optional[str] = None
    option_types: List[OptionTypeOut] = []
    variants: List[ProductVariantOut] = []
    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def set_primary_image(self) -> "ProductOut":
        if self.primary_image is None and self.images:
            primary = next((img.url for img in self.images if img.is_primary), None)
            self.primary_image = primary or self.images[0].url
        return self


class ProductListOut(BaseModel):
    id: str
    name: str
    slug: str
    sku: str
    description: Optional[str] = None
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
    has_variants: bool = False
    model_config = {"from_attributes": True}


class CsvImportError(BaseModel):
    row: int
    error: str


class CsvImportResult(BaseModel):
    created: int
    updated: int = 0
    errors: list[CsvImportError]
    warnings: list[str] = []


class DuplicateProductEntry(BaseModel):
    id: str
    name: str
    price: Decimal
    stock_quantity: int
    category_id: Optional[str] = None
    created_at: Optional[str] = None
    model_config = {"from_attributes": True}


class DuplicateGroup(BaseModel):
    name: str
    products: list[DuplicateProductEntry]


class DeleteDuplicatesRequest(BaseModel):
    keep_ids: list[str]


class DeleteDuplicatesResult(BaseModel):
    deleted: int


class OptionValueOut(BaseModel):
    id: str
    label: str
    sort_order: int
    model_config = {"from_attributes": True}


class OptionTypeOut(BaseModel):
    id: str
    name: str
    sort_order: int
    values: list[OptionValueOut] = []
    model_config = {"from_attributes": True}


class OptionTypeCreate(BaseModel):
    name: str
    sort_order: int = 0


class OptionValueCreate(BaseModel):
    label: str
    sort_order: int = 0


class VariantOptionLink(BaseModel):
    option_type_name: str
    option_value_label: str


class ProductVariantOut(BaseModel):
    id: str
    product_id: str
    sku: str
    is_default: bool
    is_active: bool
    option_values: list[VariantOptionLink] = []
    label: str = ""
    price_adjustment: Optional[Decimal] = None
    stock_quantity: int = 0
    model_config = {"from_attributes": True}


class VariantUpdate(BaseModel):
    sku: Optional[str] = None
    is_active: Optional[bool] = None
    price_adjustment: Optional[Decimal] = None
    stock_quantity: Optional[int] = None


class VariantCsvImportError(BaseModel):
    row: int
    field: str       # column name that caused the error, e.g. "product_sku", "stock_MAIN"
    message: str


class VariantCsvImportResult(BaseModel):
    rows_processed: int
    variants_created: int
    variants_updated: int
    stock_records_set: int
    stock_records_incremented: int
    warnings: list[str]
    errors: list[VariantCsvImportError]
