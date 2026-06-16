from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.plugins.addresses import service
from app.plugins.addresses.schemas import AddressCreate, AddressUpdate, AddressOut

router = APIRouter()


@router.get("", response_model=List[AddressOut])
async def list_addresses(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.list_addresses(current_user.id, db)


@router.post("", response_model=AddressOut, status_code=status.HTTP_201_CREATED)
async def create_address(
    data: AddressCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_address(current_user.id, data, db)


@router.put("/{address_id}", response_model=AddressOut)
async def update_address(
    address_id: str,
    data: AddressUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_address(address_id, current_user.id, data, db)


@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_address(
    address_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_address(address_id, current_user.id, db)


@router.post("/{address_id}/set-default", response_model=AddressOut)
async def set_default_address(
    address_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.set_default(address_id, current_user.id, db)
