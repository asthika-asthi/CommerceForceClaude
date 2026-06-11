from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
import httpx


async def _get_system_prompt(db: AsyncSession) -> str:
    try:
        from app.plugins.branding import service as branding_service
        config = await branding_service.get_config(db)
        parts = [f"You are a helpful shopping assistant for {config.store_name}."]
        if config.tagline:
            parts.append(config.tagline)
        parts.append("Answer customer questions about products, orders, and the store. Be concise and friendly.")
        return " ".join(parts)
    except Exception:
        return "You are a helpful shopping assistant. Answer customer questions concisely and friendly."


async def chat(
    message: str,
    history: list[dict],
    db: AsyncSession,
    api_key: Optional[str] = None,
    model: str = "anthropic/claude-haiku-4-5-20251001",
) -> str:
    if not api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="AI chat is not configured (OPENROUTER_API_KEY not set)")

    system_prompt = await _get_system_prompt(db)

    messages = [{"role": m["role"], "content": m["content"]} for m in history]
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
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                            detail=f"OpenRouter error: {resp.text}")

    data = resp.json()
    return data["choices"][0]["message"]["content"]
