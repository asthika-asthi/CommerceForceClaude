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
    result = await db.execute(
        select(Category)
        .where(Category.parent_id.is_(None), Category.is_active == True)
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
