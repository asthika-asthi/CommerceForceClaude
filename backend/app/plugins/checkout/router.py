from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user_optional
from app.plugins.cart.router import GUEST_SESSION_COOKIE
from app.plugins.checkout.schemas import (
    CheckoutRequest, CheckoutSummary, PaymentMethodOut, ShippingQuoteOut, ShippingQuoteRequest,
)
from app.plugins.checkout import service

router = APIRouter()


@router.get("/payment-methods", response_model=list[PaymentMethodOut])
async def payment_methods():
    return service.AVAILABLE_PAYMENT_METHODS


@router.post("/shipping-quote", response_model=ShippingQuoteOut)
async def shipping_quote(
    data: ShippingQuoteRequest,
    request: Request,
    current_user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Delivery charge + parcel weight for the caller's cart, for display at checkout."""
    session_id = request.cookies.get(GUEST_SESSION_COOKIE) if not current_user else None
    result = await service.shipping_quote(
        data.delivery_country, db,
        user_id=current_user.id if current_user else None,
        session_id=session_id,
        coupon_code=data.coupon_code,
        redeem_points=data.redeem_points,
    )
    return ShippingQuoteOut(
        zone_name=result.zone_name, cost=result.cost, weight_kg=result.weight_kg,
        order_value=result.order_value, next_threshold=result.next_threshold,
        amount_to_next_band=result.amount_to_next_band, next_charge=result.next_charge,
    )


@router.post("", response_model=CheckoutSummary, status_code=201)
async def checkout(
    data: CheckoutRequest,
    request: Request,
    current_user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    session_id = request.cookies.get(GUEST_SESSION_COOKIE) if not current_user else None
    order, client_secret = await service.checkout(
        data=data,
        db=db,
        user_id=current_user.id if current_user else None,
        session_id=session_id,
    )
    return CheckoutSummary(
        order_id=order.id,
        order_number=order.order_number,
        subtotal=order.subtotal,
        discount_amount=order.discount_amount,
        tax_amount=order.tax_amount,
        shipping_cost=order.shipping_cost,
        total=order.total,
        payment_method=order.payment_method,
        payment_status=order.payment_status,
        status=order.status,
        client_secret=client_secret,
    )


@router.post("/stripe-webhook", status_code=200)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    await service.handle_stripe_webhook(payload, sig_header, db)
    return {"status": "ok"}
