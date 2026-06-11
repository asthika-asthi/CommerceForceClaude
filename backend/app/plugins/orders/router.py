from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.plugins.orders.schemas import OrderOut, OrderListOut, UpdateStatusRequest
from app.plugins.orders import service
from app.shared.pagination import Page, paginate

router = APIRouter()


@router.get("", response_model=Page[OrderListOut])
async def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_filter = None if current_user.role in ("superadmin", "admin") else current_user.id
    orders, total = await service.list_orders(db, user_id=user_filter, page=page, page_size=page_size)
    items = [
        OrderListOut(
            id=o.id, order_number=o.order_number, status=o.status,
            payment_method=o.payment_method, payment_status=o.payment_status,
            total=o.total, item_count=sum(i.quantity for i in o.items),
        )
        for o in orders
    ]
    return paginate(items, total, page, page_size)


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_filter = None if current_user.role in ("superadmin", "admin") else current_user.id
    return await service.get_order(order_id, db, user_id=user_filter)


@router.put("/{order_id}/status", response_model=OrderOut,
            dependencies=[Depends(require_admin())])
async def update_status(
    order_id: str, data: UpdateStatusRequest, db: AsyncSession = Depends(get_db)
):
    return await service.update_status(order_id, data, db)


@router.post("/{order_id}/cancel", response_model=OrderOut)
async def cancel_order(
    order_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.cancel_order(order_id, current_user.id, db)
