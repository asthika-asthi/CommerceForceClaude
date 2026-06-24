from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user_optional
from app.plugins.cart.router import GUEST_SESSION_COOKIE
from app.plugins.checkout.schemas import CheckoutRequest, CheckoutSummary, PaymentMethodOut
from app.plugins.checkout import service

router = APIRouter()


@router.get("/payment-methods", response_model=list[PaymentMethodOut])
async def payment_methods():
    return service.AVAILABLE_PAYMENT_METHODS


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
