from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
import httpx

from app.plugins.ai_chat.models import ChatSession, ChatMessage
from app.plugins.ai_chat.schemas import HistoryResponse, HistoryMessage


async def _get_system_prompt(db: AsyncSession, user_id: Optional[str] = None) -> str:
    parts = []
    try:
        from app.plugins.branding import service as branding_service
        config = await branding_service.get_config(db)
        parts.append(f"You are a helpful shopping assistant for {config.store_name}.")
        if config.tagline:
            parts.append(config.tagline)
    except Exception:
        parts.append("You are a helpful shopping assistant.")

    parts.append("Answer customer questions about products, orders, and the store. Be concise and friendly.")

    if user_id:
        try:
            from app.plugins.orders.models import Order, OrderStatus
            result = await db.execute(
                select(Order)
                .where(Order.user_id == user_id, Order.status == OrderStatus.delivered)
                .order_by(Order.created_at.desc())
                .limit(3)
            )
            recent_orders = result.scalars().all()
            if recent_orders:
                order_lines = []
                for o in recent_orders:
                    item_names = ", ".join(i.product_name for i in o.items) if o.items else "no items"
                    order_lines.append(
                        f"Order #{o.order_number} (delivered, total £{o.total}): {item_names}"
                    )
                parts.append(
                    "The customer's recent delivered orders: " + "; ".join(order_lines) + "."
                )
        except Exception:
            pass

    return " ".join(parts)


async def _get_or_create_session(
    session_key: str, user_id: Optional[str], db: AsyncSession
) -> ChatSession:
    result = await db.execute(
        select(ChatSession).where(ChatSession.session_key == session_key)
    )
    session = result.scalar_one_or_none()
    if session is None:
        try:
            session = ChatSession(session_key=session_key, user_id=user_id)
            db.add(session)
            await db.flush()
        except Exception:
            # Race condition: another request created the session concurrently; re-query
            await db.rollback()
            result = await db.execute(
                select(ChatSession).where(ChatSession.session_key == session_key)
            )
            session = result.scalar_one()
    elif user_id and session.user_id is None:
        # Link an anonymous session to a user when they log in
        session.user_id = user_id
    return session


async def chat(
    message: str,
    session_key: str,
    db: AsyncSession,
    user_id: Optional[str] = None,
    api_key: Optional[str] = None,
    model: str = "anthropic/claude-haiku-4-5-20251001",
) -> tuple[str, str]:
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI chat is not configured (OPENROUTER_API_KEY not set)",
        )

    session = await _get_or_create_session(session_key, user_id, db)

    # Load last 20 messages as context
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(20)
    )
    recent = list(reversed(result.scalars().all()))

    system_prompt = await _get_system_prompt(db, user_id=user_id)

    messages = [{"role": m.role, "content": m.content} for m in recent]
    messages.append({"role": "user", "content": message})

    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "max_tokens": 1024,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenRouter error: {resp.text}",
        )

    data = resp.json()
    reply = data["choices"][0]["message"]["content"]

    # Persist both turns
    db.add(ChatMessage(session_id=session.id, role="user", content=message))
    db.add(ChatMessage(session_id=session.id, role="assistant", content=reply))
    await db.commit()

    return reply, session_key


async def get_history(session_key: str, db: AsyncSession) -> HistoryResponse:
    result = await db.execute(
        select(ChatSession).where(ChatSession.session_key == session_key)
    )
    session = result.scalar_one_or_none()
    if session is None:
        return HistoryResponse(session_key=session_key, messages=[])

    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
    )
    messages = [
        HistoryMessage(role=m.role, content=m.content)
        for m in msg_result.scalars().all()
    ]
    return HistoryResponse(session_key=session_key, messages=messages)
