import csv
import io
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.plugins.orders.models import Order, OrderItem
from app.plugins.orders.schemas import OrderOut, OrderListOut, UpdateStatusRequest, FulfilRequest
from app.plugins.orders import service
from app.shared.pagination import Page, paginate

router = APIRouter()


def _csv_safe(value: str) -> str:
    """Prevent CSV formula injection by prefixing dangerous leading characters."""
    s = str(value) if value is not None else ""
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


@router.get("/export/csv", dependencies=[Depends(require_admin())])
async def export_orders_csv(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).order_by(Order.created_at.desc()))
    orders = result.scalars().all()

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "order_number", "status", "payment_method", "payment_status",
        "subtotal", "discount_amount", "total", "guest_email",
        "shipping_address", "tracking_number", "created_at",
    ])
    writer.writeheader()
    for o in orders:
        writer.writerow({
            "order_number": _csv_safe(o.order_number),
            "status": o.status,
            "payment_method": o.payment_method,
            "payment_status": o.payment_status,
            "subtotal": o.subtotal,
            "discount_amount": o.discount_amount,
            "total": o.total,
            "guest_email": _csv_safe(o.guest_email or ""),
            "shipping_address": _csv_safe((o.shipping_address or "").replace("\n", " ")),
            "tracking_number": _csv_safe(o.tracking_number or ""),
            "created_at": o.created_at.isoformat(),
        })
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="orders.csv"'},
    )


@router.get("/analytics", dependencies=[Depends(require_admin())])
async def get_analytics(db: AsyncSession = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=29)

    daily_rows = await db.execute(
        select(
            func.date(Order.created_at).label("date"),
            func.sum(Order.total).label("revenue"),
            func.count(Order.id).label("count"),
        )
        .where(Order.payment_status == "paid")
        .where(Order.created_at >= since)
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
    )
    daily_revenue = [
        {"date": r.date, "revenue": float(r.revenue or 0), "count": r.count}
        for r in daily_rows
    ]

    top_rows = await db.execute(
        select(
            OrderItem.product_name,
            func.sum(OrderItem.subtotal).label("revenue"),
            func.sum(OrderItem.quantity).label("units"),
        )
        .group_by(OrderItem.product_name)
        .order_by(func.sum(OrderItem.subtotal).desc())
        .limit(10)
    )
    top_products = [
        {"name": r.product_name, "revenue": float(r.revenue or 0), "units": r.units}
        for r in top_rows
    ]

    return {"daily_revenue": daily_revenue, "top_products": top_products}


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


@router.patch("/{order_id}/fulfil", response_model=OrderOut,
              dependencies=[Depends(require_admin())])
async def fulfil_order(
    order_id: str, data: FulfilRequest, db: AsyncSession = Depends(get_db)
):
    return await service.fulfil_order(order_id, data, db)


@router.post("/{order_id}/cancel", response_model=OrderOut)
async def cancel_order(
    order_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.cancel_order(order_id, current_user.id, db)
