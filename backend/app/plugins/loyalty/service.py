import math
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from app.plugins.loyalty.models import LoyaltyConfig, LoyaltyAccount, LoyaltyTransaction, TransactionType
from app.plugins.loyalty.schemas import LoyaltyConfigUpdate, ManualAdjustRequest


async def get_config(db: AsyncSession) -> LoyaltyConfig:
    result = await db.execute(select(LoyaltyConfig))
    config = result.scalar_one_or_none()
    if not config:
        config = LoyaltyConfig()
        db.add(config)
        await db.flush()
    return config


async def update_config(data: LoyaltyConfigUpdate, db: AsyncSession) -> LoyaltyConfig:
    config = await get_config(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    await db.flush()
    return config


async def get_or_create_account(user_id: str, db: AsyncSession, for_update: bool = False) -> LoyaltyAccount:
    q = select(LoyaltyAccount).where(LoyaltyAccount.user_id == user_id)
    if for_update:
        q = q.with_for_update()
    result = await db.execute(q)
    account = result.scalar_one_or_none()
    if not account:
        try:
            async with db.begin_nested():
                account = LoyaltyAccount(user_id=user_id)
                db.add(account)
                await db.flush()
        except IntegrityError:
            # Another request created the account concurrently — load it
            result = await db.execute(
                select(LoyaltyAccount).where(LoyaltyAccount.user_id == user_id)
            )
            account = result.scalar_one()
    return account


async def get_account(user_id: str, db: AsyncSession) -> LoyaltyAccount:
    result = await db.execute(select(LoyaltyAccount).where(LoyaltyAccount.user_id == user_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loyalty account not found")
    return account


async def list_all_accounts(db: AsyncSession) -> list[LoyaltyAccount]:
    result = await db.execute(
        select(LoyaltyAccount).order_by(LoyaltyAccount.points_balance.desc())
    )
    return list(result.scalars().all())


async def list_transactions(user_id: str, db: AsyncSession) -> list[LoyaltyTransaction]:
    result = await db.execute(
        select(LoyaltyTransaction)
        .where(LoyaltyTransaction.user_id == user_id)
        .order_by(LoyaltyTransaction.created_at.desc())
    )
    return list(result.scalars().all())


async def earn_points(
    user_id: str,
    order_total: Decimal,
    order_id: str,
    db: AsyncSession,
) -> LoyaltyAccount:
    """Award points after a successful order. Called by checkout service."""
    config = await get_config(db)
    if not config.is_active:
        return await get_or_create_account(user_id, db)

    points = math.floor(float(order_total) * float(config.points_per_dollar))
    if points <= 0:
        return await get_or_create_account(user_id, db)

    account = await get_or_create_account(user_id, db, for_update=True)
    account.points_balance += points
    account.total_earned += points

    tx = LoyaltyTransaction(
        user_id=user_id,
        order_id=order_id,
        transaction_type=TransactionType.earn,
        points=points,
        description="Points earned on order",
    )
    db.add(tx)
    await db.flush()
    return account


async def validate_redemption(
    user_id: str,
    redeem_points: int,
    db: AsyncSession,
) -> Decimal:
    """Return the discount amount for redeeming points. Raises HTTPException if invalid."""
    config = await get_config(db)
    if not config.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Loyalty program is not active")
    if redeem_points < config.min_redemption:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum {config.min_redemption} points required to redeem",
        )
    account = await get_or_create_account(user_id, db)
    if account.points_balance < redeem_points:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient points. Balance: {account.points_balance}, Requested: {redeem_points}",
        )
    discount = (Decimal(str(redeem_points)) * config.redemption_rate).quantize(Decimal("0.01"))
    return discount


async def redeem_points(
    user_id: str,
    points: int,
    order_id: str,
    discount: Decimal,
    db: AsyncSession,
) -> LoyaltyAccount:
    """Deduct points from account after a redemption. Called by checkout service."""
    account = await get_or_create_account(user_id, db, for_update=True)
    if account.points_balance < points:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Insufficient points: have {account.points_balance}, need {points}",
        )
    account.points_balance -= points
    account.total_redeemed += points

    tx = LoyaltyTransaction(
        user_id=user_id,
        order_id=order_id,
        transaction_type=TransactionType.redeem,
        points=-points,
        description=f"Redeemed {points} points for ${discount} discount",
    )
    db.add(tx)
    await db.flush()
    return account


async def manual_adjust(data: ManualAdjustRequest, db: AsyncSession) -> LoyaltyAccount:
    account = await get_or_create_account(data.user_id, db, for_update=True)
    new_balance = account.points_balance + data.points
    if new_balance < 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Adjustment would result in negative balance ({new_balance})",
        )
    account.points_balance = new_balance
    if data.points > 0:
        account.total_earned += data.points

    tx = LoyaltyTransaction(
        user_id=data.user_id,
        transaction_type=TransactionType.adjust,
        points=data.points,
        description=data.description,
    )
    db.add(tx)
    await db.flush()
    return account


async def reverse_order_points(user_id: str, order_id: str, db: AsyncSession) -> None:
    """Reverse all loyalty transactions for a cancelled order."""
    result = await db.execute(
        select(LoyaltyTransaction).where(
            LoyaltyTransaction.order_id == order_id,
            LoyaltyTransaction.user_id == user_id,
        )
    )
    transactions = result.scalars().all()
    if not transactions:
        return
    account = await get_or_create_account(user_id, db, for_update=True)
    for tx in transactions:
        account.points_balance = max(0, account.points_balance - tx.points)
        if tx.points > 0:
            account.total_earned = max(0, account.total_earned - tx.points)
        else:
            account.total_redeemed = max(0, account.total_redeemed + tx.points)
    await db.flush()
