from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.categories.schemas import CategoryCreate, CategoryUpdate, CategoryOut
from app.plugins.categories import service

router = APIRouter()


@router.get("", response_model=list[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    return await service.list_root_categories(db)


@router.get("/{category_id}", response_model=CategoryOut)
async def get_category(category_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_category(category_id, db)


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin())])
async def create_category(data: CategoryCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_category(data, db)


@router.put("/{category_id}", response_model=CategoryOut,
            dependencies=[Depends(require_admin())])
async def update_category(category_id: str, data: CategoryUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_category(category_id, data, db)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin())])
async def delete_category(category_id: str, db: AsyncSession = Depends(get_db)):
    await service.delete_category(category_id, db)
