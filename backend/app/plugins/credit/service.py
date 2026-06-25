from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from app.plugins.credit.models import CreditAccount
from app.plugins.credit.schemas import CreditAccountCreate, CreditAccountUpdate


async def _load(user_id: str, db: AsyncSession, for_update: bool = False) -> CreditAccount:
    query = select(CreditAccount).where(CreditAccount.user_id == user_id)
    if for_update:
        query = query.with_for_update()
    result = await db.execute(query)
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit account not found")
    return account


async def create_account(data: CreditAccountCreate, db: AsyncSession) -> CreditAccount:
    existing = await db.execute(select(CreditAccount).where(CreditAccount.user_id == data.user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Credit account already exists for this user")
    account = CreditAccount(user_id=data.user_id, credit_limit=data.credit_limit, notes=data.notes)
    db.add(account)
    await db.flush()
    return account


async def get_account(user_id: str, db: AsyncSession) -> CreditAccount:
    return await _load(user_id, db)


async def update_account(user_id: str, data: CreditAccountUpdate, db: AsyncSession) -> CreditAccount:
    account = await _load(user_id, db, for_update=True)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    await db.flush()
    return account


async def list_accounts(db: AsyncSession) -> list[CreditAccount]:
    result = await db.execute(select(CreditAccount))
    return list(result.scalars().all())


async def check_and_deduct(user_id: str, amount: Decimal, db: AsyncSession) -> CreditAccount:
    """Validate and deduct credit; called by checkout service."""
    account = await _load(user_id, db, for_update=True)
    if not account.is_active:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Credit account is inactive")
    if account.available_credit < amount:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient credit. Available: {account.available_credit}, Required: {amount}",
        )
    account.used_credit += amount
    await db.flush()
    return account


async def restore_credit(user_id: str, amount: Decimal, db: AsyncSession) -> CreditAccount:
    """Restore credit when an order is cancelled."""
    account = await _load(user_id, db, for_update=True)
    account.used_credit = max(Decimal("0"), account.used_credit - amount)
    await db.flush()
    return account


async def delete_account(user_id: str, db: AsyncSession) -> None:
    account = await _load(user_id, db)
    await db.delete(account)
    await db.flush()
