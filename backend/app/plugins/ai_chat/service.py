from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

try:
    import anthropic as _anthropic
except ImportError:
    _anthropic = None


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
) -> str:
    if _anthropic is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="AI chat requires the anthropic package")
    if not api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="AI chat is not configured (ANTHROPIC_API_KEY not set)")

    system_prompt = await _get_system_prompt(db)

    messages = [{"role": m["role"], "content": m["content"]} for m in history]
    messages.append({"role": "user", "content": message})

    client = _anthropic.AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    )
    return response.content[0].text
