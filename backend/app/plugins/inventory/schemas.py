from typing import Optional, List
from pydantic import BaseModel, Field


class WarehouseCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    is_default: bool = False


class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class WarehouseOut(BaseModel):
    id: str
    name: str
    code: str
    address: Optional[str] = None
    is_active: bool
    is_default: bool
    stock_items: List["WarehouseStockOut"] = []
    model_config = {"from_attributes": True}


class StockSetRequest(BaseModel):
    variant_id: str
    quantity: int = Field(..., ge=0)
    low_stock_threshold: int = Field(10, ge=0)


class StockAdjustRequest(BaseModel):
    variant_id: str
    delta: int


class WarehouseStockOut(BaseModel):
    id: str
    warehouse_id: str
    variant_id: str
    variant_label: str = ""
    quantity: int
    reserved_quantity: int
    available_quantity: int
    low_stock_threshold: int
    model_config = {"from_attributes": True}


class ProductStockSummary(BaseModel):
    variant_id: str
    total_quantity: int
    total_available: int
    warehouses: List[WarehouseStockOut]
