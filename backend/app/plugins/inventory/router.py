from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.inventory.schemas import (
    WarehouseCreate, WarehouseUpdate, WarehouseOut,
    StockSetRequest, StockAdjustRequest, WarehouseStockOut, ProductStockSummary,
)
from app.plugins.inventory import service

router = APIRouter()


@router.get("/warehouses", response_model=list[WarehouseOut])
async def list_warehouses(db: AsyncSession = Depends(get_db)):
    return await service.list_warehouses(db)


@router.post("/warehouses", response_model=WarehouseOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin())])
async def create_warehouse(data: WarehouseCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_warehouse(data, db)


@router.put("/warehouses/{warehouse_id}", response_model=WarehouseOut,
            dependencies=[Depends(require_admin())])
async def update_warehouse(
    warehouse_id: str,
    data: WarehouseUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await service.update_warehouse(warehouse_id, data, db)


@router.post("/warehouses/{warehouse_id}/stock", response_model=WarehouseStockOut,
             dependencies=[Depends(require_admin())])
async def set_stock(warehouse_id: str, data: StockSetRequest, db: AsyncSession = Depends(get_db)):
    return await service.set_stock(warehouse_id, data, db)


@router.post("/warehouses/{warehouse_id}/stock/adjust", response_model=WarehouseStockOut,
             dependencies=[Depends(require_admin())])
async def adjust_stock(warehouse_id: str, data: StockAdjustRequest, db: AsyncSession = Depends(get_db)):
    return await service.adjust_stock(warehouse_id, data, db)


@router.get("/products/{product_id}/stock", response_model=ProductStockSummary)
async def product_stock(product_id: str, db: AsyncSession = Depends(get_db)):
    items = await service.get_product_stock(product_id, db)
    total_qty = sum(s.quantity for s in items)
    total_avail = sum(s.available_quantity for s in items)
    return ProductStockSummary(
        product_id=product_id,
        total_quantity=total_qty,
        total_available=total_avail,
        warehouses=items,
    )


@router.get("/warehouses/{warehouse_id}/stock", response_model=list[WarehouseStockOut],
            dependencies=[Depends(require_admin())])
async def warehouse_stock(warehouse_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_warehouse_stock(warehouse_id, db)
