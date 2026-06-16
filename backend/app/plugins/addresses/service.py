from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.plugins.addresses.models import Address
from app.plugins.addresses.schemas import AddressCreate, AddressUpdate


async def list_addresses(user_id: str, db: AsyncSession) -> List[Address]:
    result = await db.execute(
        select(Address)
        .where(Address.user_id == user_id)
        .order_by(Address.is_default.desc(), Address.created_at)
    )
    return list(result.scalars().all())


async def create_address(user_id: str, data: AddressCreate, db: AsyncSession) -> Address:
    if data.is_default:
        await _clear_defaults(user_id, db)
    addr = Address(user_id=user_id, **data.model_dump())
    db.add(addr)
    await db.flush()
    return addr


async def update_address(address_id: str, user_id: str, data: AddressUpdate, db: AsyncSession) -> Address:
    result = await db.execute(select(Address).where(Address.id == address_id, Address.user_id == user_id))
    addr = result.scalar_one_or_none()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    if data.is_default:
        await _clear_defaults(user_id, db)
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(addr, key, val)
    await db.flush()
    return addr


async def delete_address(address_id: str, user_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(Address).where(Address.id == address_id, Address.user_id == user_id))
    addr = result.scalar_one_or_none()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    await db.delete(addr)


async def set_default(address_id: str, user_id: str, db: AsyncSession) -> Address:
    result = await db.execute(select(Address).where(Address.id == address_id, Address.user_id == user_id))
    addr = result.scalar_one_or_none()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    await _clear_defaults(user_id, db)
    addr.is_default = True
    await db.flush()
    return addr


async def _clear_defaults(user_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(Address).where(Address.user_id == user_id, Address.is_default == True))
    for addr in result.scalars().all():
        addr.is_default = False
