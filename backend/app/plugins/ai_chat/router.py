from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import get_settings
from app.plugins.ai_chat.schemas import ChatRequest, ChatResponse
from app.plugins.ai_chat import service

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(data: ChatRequest, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    reply = await service.chat(
        message=data.message,
        history=[m.model_dump() for m in data.history],
        db=db,
        api_key=getattr(settings, "ANTHROPIC_API_KEY", None) or None,
    )
    return ChatResponse(reply=reply)
