import csv
import io
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.dependencies import require_admin
from app.plugins.products.models import Product, ProductOptionType
from app.plugins.products.schemas import (
    ProductCreate, ProductUpdate, ProductOut, ProductListOut, ProductImageCreate, ProductImageOut,
    ProductImageUpdate, CsvImportResult, ImageSortItem, DuplicateGroup, DeleteDuplicatesRequest,
    DeleteDuplicatesResult,
)
from app.plugins.products import service
from app.plugins.products import variant_router
from app.plugins.products import variant_service
from app.plugins.products.schemas import OptionTypeOut
from app.shared.pagination import Page, paginate

router = APIRouter()


def _csv_safe(value: str) -> str:
    """Prevent CSV formula injection by prefixing dangerous leading characters."""
    s = str(value) if value is not None else ""
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


@router.get("/export/csv", dependencies=[Depends(require_admin())])
async def export_products_csv(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.images))
        .order_by(Product.created_at.desc())
    )
    products = result.scalars().all()

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "name", "sku", "price", "sale_price", "stock_quantity",
        "is_active", "category_id", "barcode", "created_at",
        "image_url_1", "image_url_2", "image_url_3", "image_url_4", "image_url_5",
    ])
    writer.writeheader()
    for p in products:
        sorted_imgs = sorted(p.images, key=lambda img: img.sort_order)
        writer.writerow({
            "name": _csv_safe(p.name),
            "sku": _csv_safe(p.sku or ""),
            "price": p.price,
            "sale_price": p.sale_price or "",
            "stock_quantity": p.stock_quantity,
            "is_active": p.is_active,
            "category_id": p.category_id or "",
            "barcode": _csv_safe(p.barcode or ""),
            "created_at": p.created_at.isoformat(),
            "image_url_1": _csv_safe(sorted_imgs[0].url if len(sorted_imgs) > 0 else ""),
            "image_url_2": _csv_safe(sorted_imgs[1].url if len(sorted_imgs) > 1 else ""),
            "image_url_3": _csv_safe(sorted_imgs[2].url if len(sorted_imgs) > 2 else ""),
            "image_url_4": _csv_safe(sorted_imgs[3].url if len(sorted_imgs) > 3 else ""),
            "image_url_5": _csv_safe(sorted_imgs[4].url if len(sorted_imgs) > 4 else ""),
        })
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="products.csv"'},
    )


@router.get("", response_model=Page[ProductListOut])
async def list_products(
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    in_stock_only: bool = False,
    featured_only: bool = False,
    sort_by: Optional[str] = Query(None, pattern="^(name|price|created_at)$"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    min_price: Optional[Decimal] = Query(None, ge=0),
    max_price: Optional[Decimal] = Query(None, ge=0),
    db: AsyncSession = Depends(get_db),
):
    items, total = await service.list_products(
        db, category_id=category_id, search=search,
        in_stock_only=in_stock_only, featured_only=featured_only,
        sort_by=sort_by, sort_dir=sort_dir,
        page=page, page_size=page_size,
        min_price=min_price, max_price=max_price,
    )
    product_ids = [p.id for p in items]
    variant_product_ids: set[str] = set()
    if product_ids:
        option_type_result = await db.execute(
            select(ProductOptionType.product_id)
            .where(ProductOptionType.product_id.in_(product_ids))
            .distinct()
        )
        variant_product_ids = set(option_type_result.scalars().all())

    list_items = []
    for p in items:
        primary = next((img.url for img in p.images if img.is_primary), None)
        if not primary and p.images:
            primary = p.images[0].url
        list_items.append(ProductListOut(
            id=p.id, name=p.name, slug=p.slug, sku=p.sku, description=p.description,
            category_id=p.category_id, price=p.price, sale_price=p.sale_price,
            is_on_sale=p.is_on_sale, effective_price=p.effective_price,
            stock_quantity=p.stock_quantity, in_stock=p.in_stock,
            is_active=p.is_active, is_featured=p.is_featured, primary_image=primary,
            has_variants=p.id in variant_product_ids,
        ))
    return paginate(list_items, total, page, page_size)


@router.post("/import/csv", response_model=CsvImportResult,
             dependencies=[Depends(require_admin())])
async def import_products_csv(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    content = (await file.read()).decode("utf-8")
    base_url = str(request.base_url).rstrip("/")
    result = await service.import_from_csv(content, db, base_url=base_url)
    return result


@router.get("/duplicates", response_model=list[DuplicateGroup],
            dependencies=[Depends(require_admin())])
async def find_duplicate_products(db: AsyncSession = Depends(get_db)):
    return await service.find_duplicate_groups(db)


@router.delete("/duplicates", response_model=DeleteDuplicatesResult,
               dependencies=[Depends(require_admin())])
async def delete_duplicate_products(
    data: DeleteDuplicatesRequest,
    db: AsyncSession = Depends(get_db),
):
    deleted = await service.delete_duplicates(data.keep_ids, db)
    return {"deleted": deleted}


@router.get("/{product_id}", response_model=dict)
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    product = await service.get_product(product_id, db)
    option_types = await variant_service.list_option_types(product.id, db)
    variants = await variant_service.list_variants(product.id, db)
    product_dict = ProductOut.model_validate(product).model_dump()
    product_dict["option_types"] = [OptionTypeOut.model_validate(ot).model_dump() for ot in option_types]
    product_dict["variants"] = [variant_service.build_variant_out(v) for v in variants]
    return product_dict


@router.get("/by-slug/{slug}", response_model=dict)
async def get_product_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    product = await service.get_product_by_slug(slug, db)
    option_types = await variant_service.list_option_types(product.id, db)
    variants = await variant_service.list_variants(product.id, db)
    product_dict = ProductOut.model_validate(product).model_dump()
    product_dict["option_types"] = [OptionTypeOut.model_validate(ot).model_dump() for ot in option_types]
    product_dict["variants"] = [variant_service.build_variant_out(v) for v in variants]
    return product_dict


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


@router.patch("/{product_id}/images/{image_id}", response_model=ProductImageOut,
              dependencies=[Depends(require_admin())])
async def update_image(
    product_id: str, image_id: str, data: ProductImageUpdate, db: AsyncSession = Depends(get_db)
):
    return await service.update_image(product_id, image_id, data, db)


@router.patch("/{product_id}/images", response_model=list[ProductImageOut],
              dependencies=[Depends(require_admin())])
async def reorder_images(
    product_id: str, items: list[ImageSortItem], db: AsyncSession = Depends(get_db)
):
    return await service.reorder_images(product_id, items, db)


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


router.include_router(variant_router.router)
