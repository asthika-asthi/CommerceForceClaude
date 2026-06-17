from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import get_settings
from app.core.dependencies import get_current_user_optional
from app.plugins.ai_chat.schemas import ChatRequest, ChatResponse, HistoryResponse
from app.plugins.ai_chat import service

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    settings = get_settings()
    reply, session_key = await service.chat(
        message=data.message,
        session_key=data.session_key,
        db=db,
        user_id=current_user.id if current_user else None,
        api_key=settings.OPENROUTER_API_KEY or None,
        model=settings.OPENROUTER_MODEL,
    )
    return ChatResponse(reply=reply, session_key=session_key)


@router.get("/history/{session_key}", response_model=HistoryResponse)
async def get_history(session_key: str, db: AsyncSession = Depends(get_db)):
    return await service.get_history(session_key, db)
