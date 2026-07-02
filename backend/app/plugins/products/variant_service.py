from itertools import product as itertools_product
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.plugins.products.models import (
    Product, ProductOptionType, ProductOptionValue, ProductVariant, ProductVariantOption,
)
from app.plugins.products.schemas import OptionTypeCreate, OptionValueCreate, VariantUpdate


async def _load_product(product_id: str, db: AsyncSession) -> Product:
    result = await db.execute(select(Product).where(Product.id == product_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


async def _load_option_type(option_type_id: str, db: AsyncSession) -> ProductOptionType:
    result = await db.execute(
        select(ProductOptionType).where(ProductOptionType.id == option_type_id)
        .options(selectinload(ProductOptionType.values))
    )
    opt = result.scalar_one_or_none()
    if not opt:
        raise HTTPException(status_code=404, detail="Option type not found")
    return opt


async def _load_variant(variant_id: str, db: AsyncSession) -> ProductVariant:
    result = await db.execute(
        select(ProductVariant).where(ProductVariant.id == variant_id)
        .options(
            selectinload(ProductVariant.option_links)
            .selectinload(ProductVariantOption.option_value)
            .selectinload(ProductOptionValue.option_type)
        )
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Variant not found")
    return v


async def get_or_create_default_variant(product_id: str, db: AsyncSession) -> ProductVariant:
    result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.product_id == product_id, ProductVariant.is_default == True
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    product = await _load_product(product_id, db)
    variant = ProductVariant(product_id=product_id, sku=product.sku, is_default=True, is_active=True)
    db.add(variant)
    await db.flush()
    return variant


async def list_option_types(product_id: str, db: AsyncSession) -> list[ProductOptionType]:
    result = await db.execute(
        select(ProductOptionType).where(ProductOptionType.product_id == product_id)
        .options(selectinload(ProductOptionType.values))
        .order_by(ProductOptionType.sort_order)
    )
    return list(result.scalars().all())


async def create_option_type(product_id: str, data: OptionTypeCreate, db: AsyncSession) -> ProductOptionType:
    await _load_product(product_id, db)
    opt = ProductOptionType(product_id=product_id, name=data.name, sort_order=data.sort_order)
    db.add(opt)
    await db.flush()
    result = await db.execute(
        select(ProductOptionType).where(ProductOptionType.id == opt.id)
        .options(selectinload(ProductOptionType.values))
    )
    return result.scalar_one()


async def delete_option_type(product_id: str, option_type_id: str, db: AsyncSession) -> None:
    opt = await _load_option_type(option_type_id, db)
    if opt.product_id != product_id:
        raise HTTPException(status_code=404, detail="Option type not found for this product")
    value_ids = {v.id for v in opt.values}
    if value_ids:
        result = await db.execute(
            select(ProductVariant).where(ProductVariant.product_id == product_id)
            .options(selectinload(ProductVariant.option_links))
        )
        for variant in result.scalars().all():
            linked_value_ids = {link.option_value_id for link in variant.option_links}
            if linked_value_ids & value_ids:
                variant.is_active = False
    await db.delete(opt)
    await db.flush()


async def add_option_value(product_id: str, option_type_id: str, data: OptionValueCreate, db: AsyncSession) -> ProductOptionValue:
    opt = await _load_option_type(option_type_id, db)
    if opt.product_id != product_id:
        raise HTTPException(status_code=404, detail="Option type not found for this product")
    val = ProductOptionValue(option_type_id=option_type_id, label=data.label, sort_order=data.sort_order)
    db.add(val)
    await db.flush()
    return val


async def delete_option_value(product_id: str, option_type_id: str, value_id: str, db: AsyncSession) -> None:
    opt = await _load_option_type(option_type_id, db)
    if opt.product_id != product_id:
        raise HTTPException(status_code=404, detail="Option type not found")
    result = await db.execute(
        select(ProductOptionValue).where(
            ProductOptionValue.id == value_id,
            ProductOptionValue.option_type_id == option_type_id
        )
    )
    val = result.scalar_one_or_none()
    if not val:
        raise HTTPException(status_code=404, detail="Option value not found")
    link_result = await db.execute(
        select(ProductVariantOption).where(ProductVariantOption.option_value_id == value_id)
    )
    for link in link_result.scalars().all():
        v_result = await db.execute(select(ProductVariant).where(ProductVariant.id == link.variant_id))
        variant = v_result.scalar_one_or_none()
        if variant:
            variant.is_active = False
    await db.delete(val)
    await db.flush()


async def generate_variants(product_id: str, db: AsyncSession) -> list[ProductVariant]:
    option_types = await list_option_types(product_id, db)
    if not option_types:
        raise HTTPException(status_code=400, detail="No option types defined — add options before generating variants")

    product = await _load_product(product_id, db)

    existing_result = await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == product_id)
        .options(
            selectinload(ProductVariant.option_links)
            .selectinload(ProductVariantOption.option_value)
            .selectinload(ProductOptionValue.option_type)
        )
    )
    existing_variants = list(existing_result.scalars().all())

    for v in existing_variants:
        if v.is_default:
            v.is_active = False

    axes = [opt.values for opt in option_types]
    combinations = list(itertools_product(*axes))

    result_variants = []
    for combo in combinations:
        combo_value_ids = frozenset(val.id for val in combo)

        matched = None
        for ev in existing_variants:
            if not ev.is_default:
                ev_value_ids = frozenset(link.option_value_id for link in ev.option_links)
                if ev_value_ids == combo_value_ids:
                    matched = ev
                    break

        if matched:
            matched.is_active = True
            result_variants.append(matched)
        else:
            suffix = "-".join(val.label[:3].upper() for val in combo)
            sku = f"{product.sku}-{suffix}"
            counter = 1
            base_sku = sku
            while True:
                check = await db.execute(select(ProductVariant).where(ProductVariant.sku == sku))
                if not check.scalar_one_or_none():
                    break
                sku = f"{base_sku}-{counter}"
                counter += 1

            new_variant = ProductVariant(product_id=product_id, sku=sku, is_default=False, is_active=True)
            db.add(new_variant)
            await db.flush()

            for val in combo:
                link = ProductVariantOption(variant_id=new_variant.id, option_value_id=val.id)
                db.add(link)
            await db.flush()

            reloaded = await db.execute(
                select(ProductVariant).where(ProductVariant.id == new_variant.id)
                .options(
                    selectinload(ProductVariant.option_links)
                    .selectinload(ProductVariantOption.option_value)
                    .selectinload(ProductOptionValue.option_type)
                )
            )
            result_variants.append(reloaded.scalar_one())

    await db.flush()
    return result_variants


async def list_variants(product_id: str, db: AsyncSession) -> list[ProductVariant]:
    result = await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == product_id)
        .options(
            selectinload(ProductVariant.option_links)
            .selectinload(ProductVariantOption.option_value)
            .selectinload(ProductOptionValue.option_type)
        )
        .order_by(ProductVariant.is_default.desc())
    )
    return list(result.scalars().all())


async def update_variant(product_id: str, variant_id: str, data: VariantUpdate, db: AsyncSession) -> ProductVariant:
    variant = await _load_variant(variant_id, db)
    if variant.product_id != product_id:
        raise HTTPException(status_code=404, detail="Variant not found for this product")
    updates = data.model_dump(exclude_unset=True)
    if "sku" in updates:
        check = await db.execute(
            select(ProductVariant).where(
                ProductVariant.sku == updates["sku"],
                ProductVariant.id != variant_id
            )
        )
        if check.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"SKU '{updates['sku']}' already in use")
    for k, v in updates.items():
        setattr(variant, k, v)
    await db.flush()
    return await _load_variant(variant_id, db)


def build_variant_out(variant: ProductVariant) -> dict:
    option_values = []
    for link in sorted(
        variant.option_links,
        key=lambda l: getattr(l.option_value.option_type, "sort_order", 0) if l.option_value and l.option_value.option_type else 0,
    ):
        if link.option_value is None or link.option_value.option_type is None:
            continue
        option_values.append({
            "option_type_name": link.option_value.option_type.name,
            "option_value_label": link.option_value.label,
        })
    label_parts = [f"{ov['option_type_name']}: {ov['option_value_label']}" for ov in option_values]
    return {
        "id": variant.id,
        "product_id": variant.product_id,
        "sku": variant.sku,
        "is_default": variant.is_default,
        "is_active": variant.is_active,
        "option_values": option_values,
        "label": ", ".join(label_parts),
        "price_adjustment": str(variant.price_adjustment) if variant.price_adjustment is not None else None,
    }
