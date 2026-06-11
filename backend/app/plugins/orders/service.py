import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException, status
from app.plugins.orders.models import Order, OrderItem, OrderStatus, PaymentMethod, PaymentStatus
from app.plugins.orders.schemas import UpdateStatusRequest

logger = logging.getLogger(__name__)


def _generate_order_number() -> str:
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    suffix = uuid.uuid4().hex[:6].upper()
    return f"CF-{date_str}-{suffix}"


async def get_order(order_id: str, db: AsyncSession, user_id: Optional[str] = None) -> Order:
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if user_id and order.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return order


async def list_orders(
    db: AsyncSession,
    user_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Order], int]:
    query = select(Order)
    if user_id:
        query = query.where(Order.user_id == user_id)
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()
    query = query.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def create_order(
    items: list[dict],
    payment_method: PaymentMethod,
    db: AsyncSession,
    user_id: Optional[str] = None,
    guest_email: Optional[str] = None,
    shipping_address: Optional[str] = None,
    notes: Optional[str] = None,
    discount_amount: Decimal = Decimal("0"),
    tax_amount: Decimal = Decimal("0"),
) -> Order:
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order must have at least one item")

    subtotal = sum(Decimal(str(i["unit_price"])) * i["quantity"] for i in items)
    total = subtotal - discount_amount + tax_amount

    order = Order(
        order_number=_generate_order_number(),
        user_id=user_id,
        guest_email=guest_email,
        payment_method=payment_method,
        payment_status=PaymentStatus.pending,
        status=OrderStatus.pending,
        subtotal=subtotal,
        discount_amount=discount_amount,
        tax_amount=tax_amount,
        total=total,
        shipping_address=shipping_address,
        notes=notes,
    )
    db.add(order)
    await db.flush()

    for item_data in items:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item_data.get("product_id"),
            product_name=item_data["product_name"],
            product_sku=item_data["product_sku"],
            unit_price=Decimal(str(item_data["unit_price"])),
            quantity=item_data["quantity"],
            subtotal=Decimal(str(item_data["unit_price"])) * item_data["quantity"],
        )
        db.add(order_item)

    await db.flush()
    return order


async def update_status(order_id: str, data: UpdateStatusRequest, db: AsyncSession) -> Order:
    order = await get_order(order_id, db)
    order.status = data.status
    await db.flush()
    return order


async def cancel_order(order_id: str, user_id: str, db: AsyncSession) -> Order:
    order = await get_order(order_id, db, user_id=user_id)
    if order.status not in (OrderStatus.pending, OrderStatus.confirmed):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel order with status '{order.status}'",
        )
    order.status = OrderStatus.cancelled
    await db.flush()

    # Restore product stock for each order item
    try:
        from app.plugins.products import service as product_service
        for item in order.items:
            if item.product_id:
                await product_service.restore_stock(item.product_id, item.quantity, db)
    except ImportError:
        pass

    # Refund credit if paid via credit limit
    if order.payment_method == PaymentMethod.credit_limit:
        try:
            from app.plugins.credit import service as credit_service
            await credit_service.restore_credit(order.user_id, order.total, db)
        except ImportError:
            pass
        except HTTPException as e:
            logger.warning(
                "Credit restore failed for order %s (user %s): %s — credit may need manual reconciliation",
                order.id, order.user_id, e.detail,
            )

    # Reverse loyalty points for registered users
    if order.user_id:
        try:
            from app.plugins.loyalty import service as loyalty_service
            await loyalty_service.reverse_order_points(order.user_id, order.id, db)
        except ImportError:
            pass

    return order
