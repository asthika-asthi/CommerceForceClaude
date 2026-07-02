import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.plugins.rfq.models import RFQ, RFQItem, RFQStatus
from app.plugins.rfq.schemas import RFQCreate, RFQQuoteRequest


def _generate_rfq_number() -> str:
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    suffix = uuid.uuid4().hex[:6].upper()
    return f"CF-RFQ-{date_str}-{suffix}"


async def _load(rfq_id: str, db: AsyncSession, for_update: bool = False) -> RFQ:
    query = select(RFQ).where(RFQ.id == rfq_id).options(selectinload(RFQ.items))
    if for_update:
        query = query.with_for_update()
    result = await db.execute(query)
    rfq = result.scalar_one_or_none()
    if not rfq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found")
    return rfq


async def create_rfq(data: RFQCreate, user_id: str, db: AsyncSession) -> RFQ:
    rfq = RFQ(
        rfq_number=_generate_rfq_number(),
        user_id=user_id,
        status=RFQStatus.draft,
        notes=data.notes,
    )
    db.add(rfq)
    await db.flush()

    for item_data in data.items:
        item = RFQItem(
            rfq_id=rfq.id,
            product_id=item_data.product_id,
            product_name=item_data.product_name,
            product_sku=item_data.product_sku,
            requested_quantity=item_data.requested_quantity,
            notes=item_data.notes,
        )
        db.add(item)

    await db.flush()
    rfq_id = rfq.id
    db.expire(rfq)
    return await _load(rfq_id, db)


async def list_rfqs(
    db: AsyncSession,
    user_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[RFQ], int]:
    base_q = select(RFQ)
    if user_id:
        base_q = base_q.where(RFQ.user_id == user_id)
    count_result = await db.execute(select(func.count()).select_from(base_q.subquery()))
    total = count_result.scalar_one()
    result = await db.execute(
        base_q.options(selectinload(RFQ.items))
        .order_by(RFQ.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all()), total


async def submit_rfq(rfq_id: str, user_id: str, db: AsyncSession) -> RFQ:
    rfq = await _load(rfq_id, db, for_update=True)
    if rfq.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if rfq.status != RFQStatus.draft:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"RFQ is already {rfq.status}")
    rfq.status = RFQStatus.submitted
    await db.flush()
    db.expire(rfq)
    return await _load(rfq_id, db)


async def review_rfq(rfq_id: str, db: AsyncSession) -> RFQ:
    rfq = await _load(rfq_id, db, for_update=True)
    if rfq.status != RFQStatus.submitted:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="RFQ must be submitted first")
    rfq.status = RFQStatus.under_review
    await db.flush()
    db.expire(rfq)
    return await _load(rfq_id, db)


async def quote_rfq(rfq_id: str, data: RFQQuoteRequest, db: AsyncSession) -> RFQ:
    rfq = await _load(rfq_id, db, for_update=True)
    if rfq.status not in (RFQStatus.submitted, RFQStatus.under_review):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot quote RFQ with status '{rfq.status}'"
        )
    rfq.status = RFQStatus.quoted
    rfq.admin_notes = data.admin_notes
    rfq.valid_until = data.valid_until

    item_map = {item.id: item for item in rfq.items}
    for q in data.item_quotes:
        item = item_map.get(q.rfq_item_id)
        if item:
            item.quoted_price = q.quoted_price

    await db.flush()
    db.expire(rfq)
    return await _load(rfq_id, db)


async def accept_rfq(rfq_id: str, user_id: str, db: AsyncSession):
    from app.plugins.orders import service as order_service
    from app.plugins.orders.models import PaymentMethod

    rfq = await _load(rfq_id, db, for_update=True)
    if rfq.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if rfq.status != RFQStatus.quoted:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="RFQ is not in quoted state")
    if any(item.quoted_price is None for item in rfq.items):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="All items must have a quoted price")

    order_items = [
        {
            "product_id": item.product_id,
            "product_name": item.product_name,
            "product_sku": item.product_sku or "",
            "unit_price": item.quoted_price,
            "quantity": item.requested_quantity,
        }
        for item in rfq.items
    ]

    # Stock and credit are deducted before order creation.
    # If create_order raises, get_db's exception handler rolls back the entire
    # session, so no partial writes persist.

    # Step 1: Validate and deduct stock BEFORE creating the order.
    # If stock is insufficient the HTTPException propagates here, no order is created.
    try:
        from app.plugins.products import service as product_service
        for item in rfq.items:
            if item.product_id:
                await product_service.deduct_stock(item.product_id, item.requested_quantity, db)
    except ImportError:
        pass  # products plugin optional; stock not validated if absent

    # Step 2: Create the order to obtain the authoritative total (create_order uses
    # Decimal arithmetic internally, which may differ from a raw-float pre-computation).
    order = await order_service.create_order(
        items=order_items,
        payment_method=PaymentMethod.credit_limit,
        db=db,
        user_id=user_id,
        notes=f"Created from RFQ {rfq.rfq_number}",
    )

    # Step 3: Validate and deduct customer credit using order.total so the deducted
    # amount exactly matches what the order records.
    # If credit is insufficient or missing the HTTPException propagates here and
    # get_db rolls back the entire session (no partial writes persist).
    _payment_status = None
    try:
        from app.plugins.credit import service as credit_service
        from app.plugins.orders.models import PaymentStatus
        await credit_service.check_and_deduct(user_id, order.total, db)
        _payment_status = PaymentStatus.paid
    except ImportError:
        pass

    if _payment_status is not None:
        order.payment_status = _payment_status

    rfq.status = RFQStatus.accepted
    await db.flush()

    return order


async def reject_rfq(rfq_id: str, db: AsyncSession, user_id: Optional[str] = None) -> RFQ:
    rfq = await _load(rfq_id, db, for_update=True)
    if user_id and rfq.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if rfq.status in (RFQStatus.accepted, RFQStatus.rejected):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"RFQ is already {rfq.status}")
    rfq.status = RFQStatus.rejected
    await db.flush()
    db.expire(rfq)
    return await _load(rfq_id, db)
