from decimal import Decimal
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.plugins.cart.models import Cart, CartItem
from app.plugins.cart.schemas import CartOut, CartItemOut
from app.plugins.products.models import Product, ProductImage, ProductVariant, ProductVariantOption, ProductOptionValue
from app.plugins.products import variant_service as vs


async def _load_cart(cart_id: str, db: AsyncSession) -> Cart:
    result = await db.execute(
        select(Cart).where(Cart.id == cart_id)
        .options(selectinload(Cart.items))
    )
    return result.scalar_one()


async def _get_or_create_cart(
    db: AsyncSession, user_id: Optional[str] = None, session_id: Optional[str] = None
) -> Cart:
    if user_id:
        result = await db.execute(
            select(Cart).where(Cart.user_id == user_id).options(selectinload(Cart.items))
        )
    elif session_id:
        result = await db.execute(
            select(Cart).where(Cart.session_id == session_id).options(selectinload(Cart.items))
        )
    else:
        raise HTTPException(status_code=400, detail="user_id or session_id required")

    cart = result.scalar_one_or_none()
    if not cart:
        cart = Cart(user_id=user_id, session_id=session_id)
        db.add(cart)
        await db.flush()
        cart_id = cart.id
        db.expire(cart)
        cart = await _load_cart(cart_id, db)
    return cart


async def _load_variant_with_options(variant_id: str, db: AsyncSession) -> Optional[ProductVariant]:
    result = await db.execute(
        select(ProductVariant).where(ProductVariant.id == variant_id)
        .options(
            selectinload(ProductVariant.option_links)
            .selectinload(ProductVariantOption.option_value)
            .selectinload(ProductOptionValue.option_type)
        )
    )
    return result.scalar_one_or_none()


async def _build_cart_out(cart: Cart, db: AsyncSession) -> CartOut:
    items_out = []
    subtotal = Decimal("0")

    for item in cart.items:
        # Load variant with option links for label building
        variant = await _load_variant_with_options(item.variant_id, db)
        if not variant:
            continue

        # Load product via variant
        result = await db.execute(
            select(Product).where(Product.id == variant.product_id)
            .options(selectinload(Product.images))
        )
        product = result.scalar_one_or_none()
        if not product:
            continue

        primary = next((img.url for img in product.images if img.is_primary), None)
        if not primary and product.images:
            primary = product.images[0].url

        unit_price = product.effective_price
        line_total = unit_price * item.quantity
        subtotal += line_total

        variant_label = vs.build_variant_out(variant)["label"]

        items_out.append(CartItemOut(
            id=item.id,
            variant_id=item.variant_id,
            product_id=product.id,
            variant_label=variant_label,
            product_name=product.name,
            product_sku=product.sku,
            product_slug=product.slug,
            unit_price=unit_price,
            quantity=item.quantity,
            line_total=line_total,
            primary_image=primary,
            in_stock=product.in_stock,
            stock_quantity=product.stock_quantity,
        ))

    return CartOut(
        id=cart.id,
        user_id=cart.user_id,
        items=items_out,
        subtotal=subtotal,
        item_count=sum(i.quantity for i in cart.items),
    )


async def get_cart(
    db: AsyncSession, user_id: Optional[str] = None, session_id: Optional[str] = None
) -> CartOut:
    cart = await _get_or_create_cart(db, user_id=user_id, session_id=session_id)
    return await _build_cart_out(cart, db)


async def add_item(
    variant_id: str,
    quantity: int,
    db: AsyncSession,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> CartOut:
    # Load variant
    result = await db.execute(
        select(ProductVariant).where(ProductVariant.id == variant_id)
    )
    variant = result.scalar_one_or_none()
    if not variant or not variant.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    # Load product
    result = await db.execute(
        select(Product).where(Product.id == variant.product_id, Product.is_active == True)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # Stock check against product.stock_quantity (warehouse stock check added in Task 6)
    if product.stock_quantity < quantity:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Insufficient stock")

    cart = await _get_or_create_cart(db, user_id=user_id, session_id=session_id)

    result = await db.execute(
        select(CartItem).where(CartItem.cart_id == cart.id, CartItem.variant_id == variant_id)
    )
    item = result.scalar_one_or_none()
    if item:
        item.quantity += quantity
    else:
        item = CartItem(cart_id=cart.id, variant_id=variant_id, quantity=quantity)
        db.add(item)
    await db.flush()
    # Reload cart so items collection reflects the new item
    cart_id = cart.id
    db.expire(cart)
    cart = await _load_cart(cart_id, db)
    return await _build_cart_out(cart, db)


async def update_item(
    variant_id: str,
    quantity: int,
    db: AsyncSession,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> CartOut:
    cart = await _get_or_create_cart(db, user_id=user_id, session_id=session_id)
    result = await db.execute(
        select(CartItem).where(CartItem.cart_id == cart.id, CartItem.variant_id == variant_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not in cart")
    if quantity > 0:
        # Load variant to get product for stock check
        v_result = await db.execute(
            select(ProductVariant).where(ProductVariant.id == variant_id)
        )
        variant = v_result.scalar_one_or_none()
        if variant:
            result2 = await db.execute(
                select(Product).where(Product.id == variant.product_id, Product.is_active == True)
            )
            product = result2.scalar_one_or_none()
            if product and product.stock_quantity < quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Only {product.stock_quantity} units available",
                )
    if quantity <= 0:
        await db.delete(item)
    else:
        item.quantity = quantity
    await db.flush()
    cart_id = cart.id
    db.expire(cart)
    cart = await _load_cart(cart_id, db)
    return await _build_cart_out(cart, db)


async def remove_item(
    variant_id: str,
    db: AsyncSession,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> CartOut:
    return await update_item(variant_id, 0, db, user_id=user_id, session_id=session_id)


async def clear_cart(
    db: AsyncSession, user_id: Optional[str] = None, session_id: Optional[str] = None
) -> None:
    cart = await _get_or_create_cart(db, user_id=user_id, session_id=session_id)
    for item in list(cart.items):
        await db.delete(item)
    await db.flush()


async def merge_guest_cart(user_id: str, session_id: str, db: AsyncSession) -> CartOut:
    """Merge guest cart into user cart on login."""
    guest_result = await db.execute(
        select(Cart).where(Cart.session_id == session_id).options(selectinload(Cart.items))
    )
    guest_cart = guest_result.scalar_one_or_none()
    if not guest_cart or not guest_cart.items:
        return await get_cart(db, user_id=user_id)

    user_result = await db.execute(
        select(Cart).where(Cart.user_id == user_id).options(selectinload(Cart.items))
    )
    user_cart = user_result.scalar_one_or_none()
    if not user_cart:
        guest_cart.user_id = user_id
        guest_cart.session_id = None
        await db.flush()
        cart_id = guest_cart.id
        db.expire(guest_cart)
        return await _build_cart_out(await _load_cart(cart_id, db), db)

    for guest_item in guest_cart.items:
        existing = next((i for i in user_cart.items if i.variant_id == guest_item.variant_id), None)
        if existing:
            existing.quantity += guest_item.quantity
        else:
            new_item = CartItem(cart_id=user_cart.id, variant_id=guest_item.variant_id, quantity=guest_item.quantity)
            db.add(new_item)

    await db.delete(guest_cart)
    await db.flush()
    cart_id = user_cart.id
    db.expire(user_cart)
    return await _build_cart_out(await _load_cart(cart_id, db), db)
