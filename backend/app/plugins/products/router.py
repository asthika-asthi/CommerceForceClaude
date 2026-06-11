from typing import Optional
from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.products.schemas import (
    ProductCreate, ProductUpdate, ProductOut, ProductListOut, ProductImageCreate, ProductImageOut,
    CsvImportResult,
)
from app.plugins.products import service
from app.shared.pagination import Page, paginate

router = APIRouter()


@router.get("", response_model=Page[ProductListOut])
async def list_products(
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    in_stock_only: bool = False,
    featured_only: bool = False,
    sort_by: Optional[str] = Query(None, pattern="^(name|price|created_at)$"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    items, total = await service.list_products(
        db, category_id=category_id, search=search,
        in_stock_only=in_stock_only, featured_only=featured_only,
        sort_by=sort_by, sort_dir=sort_dir,
        page=page, page_size=page_size,
    )
    list_items = []
    for p in items:
        primary = next((img.url for img in p.images if img.is_primary), None)
        if not primary and p.images:
            primary = p.images[0].url
        list_items.append(ProductListOut(
            id=p.id, name=p.name, slug=p.slug, sku=p.sku,
            category_id=p.category_id, price=p.price, sale_price=p.sale_price,
            is_on_sale=p.is_on_sale, effective_price=p.effective_price,
            stock_quantity=p.stock_quantity, in_stock=p.in_stock,
            is_active=p.is_active, is_featured=p.is_featured, primary_image=primary,
        ))
    return paginate(list_items, total, page, page_size)


@router.post("/import/csv", response_model=CsvImportResult,
             dependencies=[Depends(require_admin())])
async def import_products_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    content = (await file.read()).decode("utf-8")
    result = await service.import_from_csv(content, db)
    return result


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_product(product_id, db)


@router.get("/by-slug/{slug}", response_model=ProductOut)
async def get_product_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    return await service.get_product_by_slug(slug, db)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin())])
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_product(data, db)


@router.put("/{product_id}", response_model=ProductOut,
            dependencies=[Depends(require_admin())])
async def update_product(product_id: str, data: ProductUpdate, db: AsyncSession = Depends(get_db)):
    return await service.update_product(product_id, data, db)


@router.post("/{product_id}/images", response_model=ProductImageOut,
             status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin())])
async def add_image(product_id: str, data: ProductImageCreate, db: AsyncSession = Depends(get_db)):
    return await service.add_image(product_id, data, db)


@router.delete("/{product_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin())])
async def remove_image(product_id: str, image_id: str, db: AsyncSession = Depends(get_db)):
    await service.remove_image(product_id, image_id, db)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin())])
async def delete_product(product_id: str, db: AsyncSession = Depends(get_db)):
    await service.delete_product(product_id, db)


@router.patch("/{product_id}/deactivate", response_model=ProductOut,
              dependencies=[Depends(require_admin())])
async def deactivate_product(product_id: str, db: AsyncSession = Depends(get_db)):
    return await service.update_product(product_id, type("U", (), {"model_dump": lambda s, **k: {"is_active": False}})(), db)
