from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.plugins.auth.models import User
from app.plugins.rfq.schemas import RFQCreate, RFQQuoteRequest, RFQOut, RFQPageOut
from app.plugins.rfq import service

router = APIRouter()


@router.post("", response_model=RFQOut, status_code=status.HTTP_201_CREATED)
async def create_rfq(
    data: RFQCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await service.create_rfq(data, current_user.id, db)


@router.get("", response_model=RFQPageOut)
async def list_rfqs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_id = None if current_user.role in ("superadmin", "admin") else current_user.id
    items, total = await service.list_rfqs(db, user_id=user_id, page=page, page_size=page_size)
    return RFQPageOut(items=items, total=total, page=page, page_size=page_size)


@router.get("/{rfq_id}", response_model=RFQOut)
async def get_rfq(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rfq = await service._load(rfq_id, db)
    if current_user.role not in ("superadmin", "admin") and rfq.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return rfq


@router.post("/{rfq_id}/submit", response_model=RFQOut)
async def submit_rfq(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await service.submit_rfq(rfq_id, current_user.id, db)


@router.post("/{rfq_id}/review", response_model=RFQOut, dependencies=[Depends(require_admin())])
async def review_rfq(rfq_id: str, db: AsyncSession = Depends(get_db)):
    return await service.review_rfq(rfq_id, db)


@router.post("/{rfq_id}/quote", response_model=RFQOut, dependencies=[Depends(require_admin())])
async def quote_rfq(
    rfq_id: str,
    data: RFQQuoteRequest,
    db: AsyncSession = Depends(get_db),
):
    return await service.quote_rfq(rfq_id, data, db)


@router.post("/{rfq_id}/accept", response_model=dict)
async def accept_rfq(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = await service.accept_rfq(rfq_id, current_user.id, db)
    return {"order_id": order.id, "order_number": order.order_number}


@router.post("/{rfq_id}/reject", response_model=RFQOut)
async def reject_rfq(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_id = None if current_user.role in ("superadmin", "admin") else current_user.id
    return await service.reject_rfq(rfq_id, db, user_id=user_id)
