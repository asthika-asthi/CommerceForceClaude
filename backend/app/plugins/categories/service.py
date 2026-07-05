import csv
import io
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.plugins.categories.models import Category
from app.plugins.categories.schemas import CategoryCreate, CategoryUpdate
from app.shared.slug import slugify


async def _get_existing_slugs(db: AsyncSession) -> set[str]:
    result = await db.execute(select(Category.slug))
    return {row[0] for row in result.fetchall()}


def _children_opt():
    # 3 levels deep — sufficient for top → mid → leaf hierarchies
    return (
        selectinload(Category.children)
        .selectinload(Category.children)
        .selectinload(Category.children)
    )


async def _load(category_id: str, db: AsyncSession) -> Category:
    result = await db.execute(
        select(Category)
        .where(Category.id == category_id)
        .options(_children_opt())
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return cat


async def create_category(data: CategoryCreate, db: AsyncSession) -> Category:
    existing = await _get_existing_slugs(db)
    slug = slugify(data.name)
    if slug in existing:
        base, i = slug, 2
        while f"{base}-{i}" in existing:
            i += 1
        slug = f"{base}-{i}"

    cat = Category(
        name=data.name,
        slug=slug,
        description=data.description,
        parent_id=data.parent_id,
        image_url=data.image_url,
        sort_order=data.sort_order,
    )
    db.add(cat)
    await db.flush()
    cat_id = cat.id  # capture before expire
    db.expire(cat)
    return await _load(cat_id, db)


async def get_category(category_id: str, db: AsyncSession) -> Category:
    return await _load(category_id, db)


async def list_root_categories(db: AsyncSession) -> list[Category]:
    from app.plugins.products.models import Product  # lazy to avoid circular import at module load
    has_products = (
        select(Product.id)
        .where(Product.category_id == Category.id, Product.is_active == True)
        .exists()
    )
    result = await db.execute(
        select(Category)
        .where(Category.parent_id.is_(None), Category.is_active == True, has_products)
        .options(_children_opt())
        .order_by(Category.sort_order, Category.name)
    )
    return list(result.scalars().all())


async def list_all_categories(db: AsyncSession) -> list[Category]:
    """Every root category (with children) — including empty and inactive ones.

    Used by the admin so that categories imported before any products exist are still
    visible for management. The storefront uses list_root_categories (filtered) instead.
    """
    result = await db.execute(
        select(Category)
        .where(Category.parent_id.is_(None))
        .options(_children_opt())
        .order_by(Category.sort_order, Category.name)
    )
    return list(result.scalars().all())


async def update_category(category_id: str, data: CategoryUpdate, db: AsyncSession) -> Category:
    cat = await _load(category_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)
    await db.flush()
    cat_id = cat.id
    db.expire(cat)
    return await _load(cat_id, db)


async def delete_category(category_id: str, db: AsyncSession) -> None:
    cat = await _load(category_id, db)
    await db.delete(cat)


async def export_to_csv(db: AsyncSession) -> str:
    result = await db.execute(select(Category).order_by(Category.sort_order, Category.name))
    all_cats = list(result.scalars().all())
    id_to_name = {c.id: c.name for c in all_cats}

    # BFS order: parents before children
    ordered: list[Category] = []
    seen: set[str] = set()
    queue = [c for c in all_cats if c.parent_id is None]
    queue.sort(key=lambda c: (c.sort_order, c.name))
    while queue:
        cat = queue.pop(0)
        if cat.id in seen:
            continue
        seen.add(cat.id)
        ordered.append(cat)
        children = sorted(
            [c for c in all_cats if c.parent_id == cat.id],
            key=lambda c: (c.sort_order, c.name),
        )
        queue.extend(children)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["name", "description", "parent", "sort_order", "is_active", "image_url"],
    )
    writer.writeheader()
    for c in ordered:
        writer.writerow({
            "name": c.name,
            "description": c.description or "",
            "parent": id_to_name.get(c.parent_id, "") if c.parent_id else "",
            "sort_order": c.sort_order,
            "is_active": str(c.is_active).lower(),
            "image_url": c.image_url or "",
        })
    output.seek(0)
    return output.getvalue()


async def import_from_csv(content: str, db: AsyncSession) -> dict:
    rows = list(csv.DictReader(io.StringIO(content)))
    created = updated = 0
    errors: list[dict] = []

    # Build name → category map from existing DB rows (case-insensitive)
    result = await db.execute(select(Category))
    name_to_cat: dict[str, Category] = {c.name.lower(): c for c in result.scalars().all()}

    true_values = {"true", "1", "yes"}

    # Two passes so parents are resolved before children
    for pass_rows in (
        [r for r in rows if not (r.get("parent") or "").strip()],
        [r for r in rows if (r.get("parent") or "").strip()],
    ):
        for idx, row in enumerate(pass_rows):
            name = (row.get("name") or "").strip()
            if not name:
                errors.append({"row": idx + 2, "error": "name is required"})
                continue

            parent_name = (row.get("parent") or "").strip()
            parent_id = None
            if parent_name:
                parent_cat = name_to_cat.get(parent_name.lower())
                if not parent_cat:
                    errors.append({"row": idx + 2, "error": f"parent '{parent_name}' not found — import parent rows first"})
                    continue
                parent_id = str(parent_cat.id)

            description = (row.get("description") or "").strip() or None
            image_url = (row.get("image_url") or "").strip() or None
            try:
                sort_order = int((row.get("sort_order") or "0").strip())
            except ValueError:
                sort_order = 0
            is_active = (row.get("is_active") or "true").strip().lower() in true_values

            name_lower = name.lower()
            if name_lower in name_to_cat:
                # Update existing
                cat = name_to_cat[name_lower]
                cat.description = description
                cat.parent_id = parent_id
                cat.image_url = image_url
                cat.sort_order = sort_order
                cat.is_active = is_active
                await db.flush()
                updated += 1
            else:
                # Create new
                new_cat = await create_category(
                    CategoryCreate(
                        name=name,
                        description=description,
                        parent_id=parent_id,
                        image_url=image_url,
                        sort_order=sort_order,
                    ),
                    db,
                )
                name_to_cat[name.lower()] = new_cat
                created += 1

    return {"created": created, "updated": updated, "errors": errors}
