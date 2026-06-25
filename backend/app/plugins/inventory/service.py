from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.plugins.inventory.models import Warehouse, WarehouseStock
from app.plugins.inventory.schemas import WarehouseCreate, WarehouseUpdate, StockSetRequest, StockAdjustRequest


async def _load_warehouse(warehouse_id: str, db: AsyncSession) -> Warehouse:
    result = await db.execute(
        select(Warehouse).where(Warehouse.id == warehouse_id)
        .options(selectinload(Warehouse.stock_items))
    )
    wh = result.scalar_one_or_none()
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return wh


async def create_warehouse(data: WarehouseCreate, db: AsyncSession) -> Warehouse:
    existing = await db.execute(select(Warehouse).where(Warehouse.code == data.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Warehouse code '{data.code}' already exists")
    if data.is_default:
        result = await db.execute(select(Warehouse).where(Warehouse.is_default == True).with_for_update())
        for wh in result.scalars().all():
            wh.is_default = False
    wh = Warehouse(name=data.name, code=data.code, address=data.address, is_default=data.is_default)
    db.add(wh)
    await db.flush()
    return await _load_warehouse(wh.id, db)


async def list_warehouses(db: AsyncSession) -> list[Warehouse]:
    result = await db.execute(select(Warehouse).order_by(Warehouse.name))
    return list(result.scalars().all())


async def delete_warehouse(warehouse_id: str, db: AsyncSession) -> None:
    wh = await _load_warehouse(warehouse_id, db)
    if wh.is_default:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete the default warehouse. Reassign the default to another warehouse first.",
        )
    await db.delete(wh)
    await db.flush()


async def update_warehouse(warehouse_id: str, data: WarehouseUpdate, db: AsyncSession) -> Warehouse:
    wh = await _load_warehouse(warehouse_id, db)
    if data.is_default:
        result = await db.execute(
            select(Warehouse).where(Warehouse.is_default == True, Warehouse.id != warehouse_id).with_for_update()
        )
        for other in result.scalars().all():
            other.is_default = False
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(wh, field, value)
    await db.flush()
    wh_id = wh.id
    db.expire(wh)
    return await _load_warehouse(wh_id, db)


async def set_stock(warehouse_id: str, data: StockSetRequest, db: AsyncSession) -> WarehouseStock:
    await _load_warehouse(warehouse_id, db)
    result = await db.execute(
        select(WarehouseStock).where(
            WarehouseStock.warehouse_id == warehouse_id,
            WarehouseStock.product_id == data.product_id,
        ).with_for_update()
    )
    stock = result.scalar_one_or_none()
    if stock:
        stock.quantity = data.quantity
        stock.low_stock_threshold = data.low_stock_threshold
    else:
        stock = WarehouseStock(
            warehouse_id=warehouse_id,
            product_id=data.product_id,
            quantity=data.quantity,
            low_stock_threshold=data.low_stock_threshold,
        )
        db.add(stock)
    await db.flush()
    return stock


async def adjust_stock(warehouse_id: str, data: StockAdjustRequest, db: AsyncSession) -> WarehouseStock:
    await _load_warehouse(warehouse_id, db)
    result = await db.execute(
        select(WarehouseStock).where(
            WarehouseStock.warehouse_id == warehouse_id,
            WarehouseStock.product_id == data.product_id,
        ).with_for_update()
    )
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No stock record for this product in this warehouse",
        )
    new_qty = stock.quantity + data.delta
    if new_qty < 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Insufficient stock: {stock.quantity} available, delta {data.delta}",
        )
    stock.quantity = new_qty
    await db.flush()
    return stock


async def get_product_stock(product_id: str, db: AsyncSession) -> list[WarehouseStock]:
    result = await db.execute(
        select(WarehouseStock).where(WarehouseStock.product_id == product_id)
    )
    return list(result.scalars().all())


async def get_warehouse_stock(warehouse_id: str, db: AsyncSession) -> list[WarehouseStock]:
    result = await db.execute(
        select(WarehouseStock).where(WarehouseStock.warehouse_id == warehouse_id)
    )
    return list(result.scalars().all())
