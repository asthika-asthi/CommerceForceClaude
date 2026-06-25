from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.products import variant_service as service
from app.plugins.products.schemas import (
    OptionTypeCreate, OptionTypeOut, OptionValueCreate, OptionValueOut, VariantUpdate,
)

router = APIRouter()


@router.get("/{product_id}/options", response_model=list[OptionTypeOut])
async def list_option_types(product_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_option_types(product_id, db)


@router.post("/{product_id}/options", response_model=OptionTypeOut, status_code=status.HTTP_201_CREATED)
async def create_option_type(
    product_id: str,
    data: OptionTypeCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin()),
):
    return await service.create_option_type(product_id, data, db)


@router.delete("/{product_id}/options/{option_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_option_type(
    product_id: str,
    option_type_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin()),
):
    await service.delete_option_type(product_id, option_type_id, db)


@router.post(
    "/{product_id}/options/{option_type_id}/values",
    response_model=OptionValueOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_option_value(
    product_id: str,
    option_type_id: str,
    data: OptionValueCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin()),
):
    return await service.add_option_value(product_id, option_type_id, data, db)


@router.delete(
    "/{product_id}/options/{option_type_id}/values/{value_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_option_value(
    product_id: str,
    option_type_id: str,
    value_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin()),
):
    await service.delete_option_value(product_id, option_type_id, value_id, db)


@router.get("/{product_id}/variants", response_model=list[dict])
async def list_variants(product_id: str, db: AsyncSession = Depends(get_db)):
    variants = await service.list_variants(product_id, db)
    return [service.build_variant_out(v) for v in variants]


@router.post("/{product_id}/variants/generate", response_model=list[dict])
async def generate_variants(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin()),
):
    variants = await service.generate_variants(product_id, db)
    return [service.build_variant_out(v) for v in variants]


@router.patch("/{product_id}/variants/{variant_id}", response_model=dict)
async def update_variant(
    product_id: str,
    variant_id: str,
    data: VariantUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin()),
):
    variant = await service.update_variant(product_id, variant_id, data, db)
    return service.build_variant_out(variant)
