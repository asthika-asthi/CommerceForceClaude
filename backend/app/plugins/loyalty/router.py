from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.plugins.auth.models import User
from app.plugins.loyalty.schemas import (
    LoyaltyConfigOut, LoyaltyConfigUpdate,
    LoyaltyAccountOut, LoyaltyTransactionOut, ManualAdjustRequest,
)
from app.plugins.loyalty import service

router = APIRouter()


@router.get("/config", response_model=LoyaltyConfigOut)
async def get_config(db: AsyncSession = Depends(get_db)):
    return await service.get_config(db)


@router.put("/config", response_model=LoyaltyConfigOut, dependencies=[Depends(require_admin())])
async def update_config(data: LoyaltyConfigUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_config(data, db)


@router.get("/me", response_model=LoyaltyAccountOut)
async def my_account(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await service.get_or_create_account(current_user.id, db)


@router.get("/me/transactions", response_model=list[LoyaltyTransactionOut])
async def my_transactions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await service.list_transactions(current_user.id, db)


@router.post("/adjust", response_model=LoyaltyAccountOut, dependencies=[Depends(require_admin())])
async def manual_adjust(data: ManualAdjustRequest, db: AsyncSession = Depends(get_db)):
    return await service.manual_adjust(data, db)
