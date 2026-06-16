import logging
from decimal import Decimal
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from app.core.config import settings
from app.plugins.cart.models import Cart
from app.plugins.products.models import Product
from app.plugins.products import service as product_service
from app.plugins.orders import service as order_service
from app.plugins.orders.models import Order, PaymentMethod, PaymentStatus
from app.plugins.checkout.schemas import CheckoutRequest, CheckoutItem
from app.shared.email import send_email

logger = logging.getLogger(__name__)

AVAILABLE_PAYMENT_METHODS = [
    {"key": "cash", "label": "Cash on Delivery", "description": "Pay when your order is delivered"},
    {"key": "credit_limit", "label": "Credit Account", "description": "Pay using your business credit limit"},
    {"key": "stripe", "label": "Card (Stripe)", "description": "Pay securely with credit or debit card"},
]


async def _resolve_cart_items(
    user_id: Optional[str],
    session_id: Optional[str],
    db: AsyncSession,
) -> list[dict]:
    if user_id:
        result = await db.execute(select(Cart).where(Cart.user_id == user_id))
    elif session_id:
        result = await db.execute(select(Cart).where(Cart.session_id == session_id))
    else:
        return []

    cart = result.scalar_one_or_none()
    if not cart or not cart.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")

    return await _items_from_cart(cart, db)


async def _items_from_cart(cart: Cart, db: AsyncSession) -> list[dict]:
    items = []
    for cart_item in cart.items:
        result = await db.execute(select(Product).where(Product.id == cart_item.product_id))
        product = result.scalar_one_or_none()
        if not product or not product.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Product '{cart_item.product_id}' is no longer available"
            )
        if product.stock_quantity < cart_item.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Insufficient stock for '{product.name}'"
            )
        items.append({
            "product_id": product.id,
            "product_name": product.name,
            "product_sku": product.sku,
            "unit_price": product.effective_price,
            "quantity": cart_item.quantity,
        })
    return items


async def _items_from_explicit(checkout_items: list[CheckoutItem], db: AsyncSession) -> list[dict]:
    items = []
    for ci in checkout_items:
        result = await db.execute(select(Product).where(Product.id == ci.product_id, Product.is_active == True))
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product '{ci.product_id}' not found")
        if product.stock_quantity < ci.quantity:
            raise HTTPException(status_code=409, detail=f"Insufficient stock for '{product.name}'")
        items.append({
            "product_id": product.id,
            "product_name": product.name,
            "product_sku": product.sku,
            "unit_price": product.effective_price,
            "quantity": ci.quantity,
        })
    return items


async def checkout(
    data: CheckoutRequest,
    db: AsyncSession,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Order:
    if data.use_cart:
        items = await _resolve_cart_items(user_id, session_id, db)
    elif data.items:
        items = await _items_from_explicit(data.items, db)
    else:
        raise HTTPException(status_code=400, detail="Provide cart items or explicit items list")

    if not user_id and not data.guest_email:
        raise HTTPException(status_code=400, detail="Guest checkout requires guest_email")

    if data.payment_method == PaymentMethod.credit_limit:
        if not user_id:
            raise HTTPException(status_code=400, detail="Credit limit payment requires a registered account")
        try:
            from app.plugins.credit import service as credit_service  # noqa: F401
        except ImportError:
            raise HTTPException(status_code=400, detail="Credit limit payment is not enabled on this platform")

    # Calculate subtotal for discount validation
    subtotal = sum(Decimal(str(i["unit_price"])) * i["quantity"] for i in items)

    # Resolve coupon discount (if coupon plugin active)
    discount_amount = Decimal("0")
    _coupon_obj = None
    if data.coupon_code:
        try:
            from app.plugins.coupons import service as coupon_service
            _coupon_obj, coupon_discount = await coupon_service.validate_coupon(data.coupon_code, subtotal, db)
            discount_amount += coupon_discount
        except ImportError:
            raise HTTPException(status_code=400, detail="Coupon codes are not enabled on this platform")

    # Resolve loyalty points redemption (if loyalty plugin active and user is authenticated)
    _points_to_redeem = 0
    _points_discount = Decimal("0")
    if data.redeem_points > 0 and user_id:
        try:
            from app.plugins.loyalty import service as loyalty_service
            _points_discount = await loyalty_service.validate_redemption(user_id, data.redeem_points, db)
            _points_to_redeem = data.redeem_points
            discount_amount += _points_discount
        except ImportError:
            raise HTTPException(status_code=400, detail="Loyalty program is not enabled on this platform")

    # Cap discount at subtotal
    discount_amount = min(discount_amount, subtotal)

    order = await order_service.create_order(
        items=items,
        payment_method=data.payment_method,
        db=db,
        user_id=user_id,
        guest_email=str(data.guest_email) if data.guest_email else None,
        shipping_address=data.shipping_address,
        notes=data.notes,
        discount_amount=discount_amount,
    )

    # Deduct stock for each item
    for item in items:
        await product_service.deduct_stock(item["product_id"], item["quantity"], db)

    # Record coupon usage
    if _coupon_obj is not None:
        from app.plugins.coupons import service as coupon_service
        await coupon_service.record_usage(_coupon_obj, order.id, coupon_discount, db, user_id=user_id)

    # Deduct redeemed loyalty points
    if _points_to_redeem > 0:
        from app.plugins.loyalty import service as loyalty_service
        await loyalty_service.redeem_points(user_id, _points_to_redeem, order.id, _points_discount, db)

    # Mark cash orders as paid immediately; deduct credit for credit_limit orders
    if data.payment_method == PaymentMethod.cash:
        order.payment_status = PaymentStatus.paid
    elif data.payment_method == PaymentMethod.credit_limit:
        from app.plugins.credit import service as credit_service
        await credit_service.check_and_deduct(user_id, order.total, db)
        order.payment_status = PaymentStatus.paid

    # Earn loyalty points on the final order total (if loyalty plugin active, authenticated user)
    if user_id:
        try:
            from app.plugins.loyalty import service as loyalty_service
            await loyalty_service.earn_points(user_id, order.total, order.id, db)
        except ImportError:
            pass  # loyalty plugin not enabled, skip silently

    # Clear the cart after successful checkout
    if data.use_cart:
        if user_id:
            result = await db.execute(select(Cart).where(Cart.user_id == user_id))
        else:
            result = await db.execute(select(Cart).where(Cart.session_id == session_id))
        cart = result.scalar_one_or_none()
        if cart:
            for ci in list(cart.items):
                await db.delete(ci)

    await db.flush()

    # Send order confirmation email
    recipient = order.guest_email
    if not recipient and user_id:
        try:
            from app.plugins.auth.models import User as UserModel
            user_result = await db.execute(select(UserModel).where(UserModel.id == user_id))
            user_obj = user_result.scalar_one_or_none()
            if user_obj:
                recipient = user_obj.email
        except Exception:
            pass
    if recipient:
        try:
            await _send_order_confirmation_email(recipient, order, items, db)
        except Exception as exc:
            logger.warning("Order confirmation email failed for order %s: %s", order.id, exc)

    return order


async def _send_order_confirmation_email(
    to: str, order: Order, items: list[dict], db: AsyncSession
) -> None:
    items_text = "\n".join(
        f"  {i['product_name']} x{i['quantity']}  £{float(i['unit_price']) * i['quantity']:.2f}"
        for i in items
    )
    payment_label = {
        "cash": "Cash on Delivery",
        "credit_limit": "Credit Account",
        "stripe": "Card",
    }.get(order.payment_method.value if hasattr(order.payment_method, "value") else str(order.payment_method), "")

    body = (
        f"Thank you for your order!\n\n"
        f"Order number: {order.order_number}\n\n"
        f"Items:\n{items_text}\n\n"
        f"Subtotal:  £{order.subtotal:.2f}\n"
    )
    if order.discount_amount > 0:
        body += f"Discount:  -£{order.discount_amount:.2f}\n"
    body += (
        f"Total:     £{order.total:.2f}\n\n"
        f"Payment:   {payment_label}\n"
    )
    if order.shipping_address:
        body += f"\nShipping address:\n{order.shipping_address}\n"
    body += "\nWe will keep you updated on your order status. Thank you for shopping with us!"

    logger.info("Order confirmation for %s: %s — £%s", to, order.order_number, order.total)
    print(f"\n[ORDER CONFIRMATION] {to} — {order.order_number} — £{order.total:.2f}\n", flush=True)

    await send_email(to, f"Order confirmed — {order.order_number}", body, db)
