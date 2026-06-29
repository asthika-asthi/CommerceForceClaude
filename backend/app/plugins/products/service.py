import csv
import io
from decimal import Decimal, InvalidOperation
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, asc, desc
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.plugins.products.models import Product, ProductImage
from app.plugins.products.schemas import ProductCreate, ProductUpdate, ProductImageCreate, ProductImageUpdate, ImageSortItem
from app.shared.slug import slugify, generate_sku
from app.plugins.categories.models import Category
from app.plugins.categories.schemas import CategoryCreate as CategoryCreateSchema


async def _get_existing_slugs(db: AsyncSession) -> set[str]:
    result = await db.execute(select(Product.slug))
    return {row[0] for row in result.fetchall()}


async def _load(product_id: str, db: AsyncSession, for_update: bool = False) -> Product:
    q = select(Product).where(Product.id == product_id).options(selectinload(Product.images))
    if for_update:
        q = q.with_for_update()
    result = await db.execute(q)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


async def create_product(data: ProductCreate, db: AsyncSession) -> Product:
    existing = await _get_existing_slugs(db)
    slug = slugify(data.name)
    if slug in existing:
        base, i = slug, 2
        while f"{base}-{i}" in existing:
            i += 1
        slug = f"{base}-{i}"

    sku = generate_sku(data.name)

    product = Product(
        name=data.name,
        slug=slug,
        description=data.description,
        sku=sku,
        category_id=data.category_id,
        price=data.price,
        sale_price=data.sale_price,
        is_on_sale=data.is_on_sale,
        stock_quantity=data.stock_quantity,
        low_stock_threshold=data.low_stock_threshold,
        is_featured=data.is_featured,
        weight=data.weight,
        tags=data.tags,
    )
    db.add(product)
    await db.flush()

    for i, img_data in enumerate(data.images):
        img = ProductImage(
            product_id=product.id,
            url=img_data.url,
            alt_text=img_data.alt_text,
            is_primary=img_data.is_primary or i == 0,
            sort_order=img_data.sort_order if img_data.sort_order else i,
        )
        db.add(img)

    await db.flush()
    product_id = product.id

    from app.plugins.products import variant_service
    await variant_service.get_or_create_default_variant(product_id, db)

    db.expire(product)
    return await _load(product_id, db)


async def get_product(product_id: str, db: AsyncSession) -> Product:
    return await _load(product_id, db)


async def get_product_by_slug(slug: str, db: AsyncSession) -> Product:
    result = await db.execute(
        select(Product).where(Product.slug == slug)
        .options(selectinload(Product.images))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


_SORT_COLS = {
    "name": Product.name,
    "price": Product.price,
    "created_at": Product.created_at,
}


async def list_products(
    db: AsyncSession,
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    in_stock_only: bool = False,
    featured_only: bool = False,
    active_only: bool = True,
    sort_by: Optional[str] = None,
    sort_dir: str = "asc",
    page: int = 1,
    page_size: int = 20,
    min_price: Optional[Decimal] = None,
    max_price: Optional[Decimal] = None,
) -> tuple[list[Product], int]:
    query = select(Product)
    if active_only:
        query = query.where(Product.is_active == True)
    if category_id:
        query = query.where(Product.category_id == category_id)
    if search:
        term = f"%{search}%"
        query = query.where(or_(Product.name.ilike(term), Product.sku.ilike(term), Product.tags.ilike(term)))
    if in_stock_only:
        query = query.where(Product.stock_quantity > 0)
    if featured_only:
        query = query.where(Product.is_featured == True)
    if min_price is not None:
        query = query.where(
            func.coalesce(Product.sale_price, Product.price) >= min_price
        )
    if max_price is not None:
        query = query.where(
            func.coalesce(Product.sale_price, Product.price) <= max_price
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    sort_col = _SORT_COLS.get(sort_by) if sort_by else None
    if sort_col is not None:
        order = asc(sort_col) if sort_dir == "asc" else desc(sort_col)
        query = query.order_by(order)
    else:
        query = query.order_by(Product.is_featured.desc(), Product.created_at.desc())

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def update_product(product_id: str, data: ProductUpdate, db: AsyncSession) -> Product:
    product = await _load(product_id, db, for_update=True)
    updates = data.model_dump(exclude_unset=True)
    if "name" in updates:
        existing = await _get_existing_slugs(db)
        existing.discard(product.slug)
        slug = slugify(updates["name"])
        if slug in existing:
            base, i = slug, 2
            while f"{base}-{i}" in existing:
                i += 1
            slug = f"{base}-{i}"
        product.slug = slug
    for field, value in updates.items():
        setattr(product, field, value)
    await db.flush()
    db.expire(product)
    return await _load(product_id, db)


async def add_image(product_id: str, data: ProductImageCreate, db: AsyncSession) -> ProductImage:
    await _load(product_id, db)
    img = ProductImage(product_id=product_id, **data.model_dump())
    db.add(img)
    await db.flush()
    return img


async def update_image(product_id: str, image_id: str, data: ProductImageUpdate, db: AsyncSession) -> ProductImage:
    result = await db.execute(
        select(ProductImage).where(ProductImage.id == image_id, ProductImage.product_id == product_id)
    )
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(img, field, value)
    await db.flush()
    return img


async def delete_product(product_id: str, db: AsyncSession) -> None:
    product = await _load(product_id, db, for_update=True)
    await db.delete(product)
    await db.flush()


async def remove_image(product_id: str, image_id: str, db: AsyncSession) -> None:
    result = await db.execute(
        select(ProductImage).where(ProductImage.id == image_id, ProductImage.product_id == product_id)
    )
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    await db.delete(img)


async def reorder_images(product_id: str, items: list[ImageSortItem], db: AsyncSession) -> list[ProductImage]:
    result = await db.execute(
        select(ProductImage).where(ProductImage.product_id == product_id)
    )
    images = {img.id: img for img in result.scalars().all()}

    for item in items:
        img = images.get(item.id)
        if not img:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Image {item.id} not found")
        img.sort_order = item.sort_order
        # First image in sorted order is primary
        img.is_primary = False

    await db.flush()

    sorted_ids = [i.id for i in sorted(items, key=lambda x: x.sort_order)]
    if sorted_ids:
        images[sorted_ids[0]].is_primary = True
    await db.flush()

    result = await db.execute(
        select(ProductImage)
        .where(ProductImage.product_id == product_id)
        .order_by(ProductImage.sort_order)
    )
    return list(result.scalars().all())


async def deduct_stock(product_id: str, quantity: int, db: AsyncSession) -> None:
    product = await _load(product_id, db, for_update=True)
    if product.stock_quantity < quantity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Insufficient stock for '{product.name}': {product.stock_quantity} available"
        )
    product.stock_quantity -= quantity
    await db.flush()


async def restore_stock(product_id: str, quantity: int, db: AsyncSession) -> None:
    product = await _load(product_id, db, for_update=True)
    product.stock_quantity += quantity
    await db.flush()


async def _resolve_category(value: str, db: AsyncSession) -> Optional[str]:
    """Accept a category name or UUID. Auto-creates the category if it doesn't exist."""
    value = value.strip()
    if not value:
        return None
    # Try by name first (case-insensitive)
    result = await db.execute(
        select(Category).where(func.lower(Category.name) == value.lower())
    )
    cat = result.scalar_one_or_none()
    if cat:
        return str(cat.id)
    # Try as UUID
    result2 = await db.execute(select(Category).where(Category.id == value))
    cat2 = result2.scalar_one_or_none()
    if cat2:
        return str(cat2.id)
    # Auto-create: treat the value as a category name
    from app.plugins.categories.service import create_category as _create_cat
    new_cat = await _create_cat(CategoryCreateSchema(name=value), db)
    return str(new_cat.id)


async def import_from_csv(
    content: str,
    db: AsyncSession,
) -> dict:
    reader = csv.DictReader(io.StringIO(content))
    created = 0
    updated = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        name = (row.get("name") or "").strip()
        price_raw = (row.get("price") or "").strip()

        if not name or not price_raw:
            errors.append({"row": i, "error": "name and price are required"})
            continue

        try:
            price = Decimal(price_raw)
        except InvalidOperation:
            errors.append({"row": i, "error": f"invalid price: {price_raw!r}"})
            continue

        sale_price_raw = (row.get("sale_price") or "").strip()
        sale_price = None
        if sale_price_raw:
            try:
                sale_price = Decimal(sale_price_raw)
            except InvalidOperation:
                errors.append({"row": i, "error": f"invalid sale_price: {sale_price_raw!r}"})
                continue

        weight_raw = (row.get("weight") or "").strip()
        weight = None
        if weight_raw:
            try:
                weight = Decimal(weight_raw)
            except InvalidOperation:
                errors.append({"row": i, "error": f"invalid weight: {weight_raw!r}"})
                continue

        stock_raw = (row.get("stock_quantity") or "0").strip()
        try:
            stock_quantity = int(stock_raw)
        except ValueError:
            errors.append({"row": i, "error": f"invalid stock_quantity: {stock_raw!r}"})
            continue

        category_raw = row.get("category") or row.get("category_id") or ""
        category_id = await _resolve_category(category_raw, db)

        true_values = {"true", "1", "yes"}

        # Deduplication: check for existing product with same name (case-insensitive)
        existing_result = await db.execute(
            select(Product).where(func.lower(Product.name) == name.lower())
        )
        existing = existing_result.scalar_one_or_none()

        if existing:
            existing.price = price
            if sale_price is not None:
                existing.sale_price = sale_price
                existing.is_on_sale = (row.get("is_on_sale") or "").lower() in true_values
            if category_id:
                existing.category_id = category_id
            if row.get("description"):
                existing.description = row["description"]
            if stock_raw != "0" or row.get("stock_quantity"):
                existing.stock_quantity = stock_quantity
            if weight is not None:
                existing.weight = weight
            if row.get("tags"):
                existing.tags = row["tags"]
            await db.flush()
            updated += 1
        else:
            data = ProductCreate(
                name=name,
                price=price,
                description=(row.get("description") or None),
                stock_quantity=stock_quantity,
                category_id=category_id,
                sale_price=sale_price,
                is_on_sale=(row.get("is_on_sale") or "").lower() in true_values,
                is_featured=(row.get("is_featured") or "").lower() in true_values,
                weight=weight,
                tags=(row.get("tags") or None),
            )
            try:
                await create_product(data, db)
                created += 1
            except Exception as exc:
                errors.append({"row": i, "error": str(exc)})

    return {"created": created, "updated": updated, "errors": errors}


async def find_duplicate_groups(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(Product).order_by(Product.created_at.asc()))
    all_products = result.scalars().all()

    groups: dict[str, list[Product]] = {}
    for p in all_products:
        key = p.name.lower()
        groups.setdefault(key, []).append(p)

    return [
        {
            "name": prods[0].name,
            "products": [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "price": p.price,
                    "stock_quantity": p.stock_quantity,
                    "category_id": str(p.category_id) if p.category_id else None,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                }
                for p in prods
            ],
        }
        for prods in groups.values()
        if len(prods) > 1
    ]


async def delete_duplicates(keep_ids: list[str], db: AsyncSession) -> int:
    groups = await find_duplicate_groups(db)
    keep_set = set(keep_ids)
    deleted = 0
    for group in groups:
        for entry in group["products"]:
            if entry["id"] not in keep_set:
                result = await db.execute(select(Product).where(Product.id == entry["id"]))
                product = result.scalar_one_or_none()
                if product:
                    await db.delete(product)
                    deleted += 1
    await db.flush()
    return deleted
