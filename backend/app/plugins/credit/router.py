from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.plugins.auth.models import User
from app.plugins.credit.schemas import CreditAccountCreate, CreditAccountUpdate, CreditAccountOut
from app.plugins.credit import service

router = APIRouter()


@router.get("/me", response_model=CreditAccountOut)
async def my_credit(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await service.get_account(current_user.id, db)


@router.get("/accounts", response_model=list[CreditAccountOut], dependencies=[Depends(require_admin())])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    return await service.list_accounts(db)


@router.post("/accounts", response_model=CreditAccountOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin())])
async def create_account(data: CreditAccountCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_account(data, db)


@router.put("/accounts/{user_id}", response_model=CreditAccountOut, dependencies=[Depends(require_admin())])
async def update_account(
    user_id: str,
    data: CreditAccountUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await service.update_account(user_id, data, db)
