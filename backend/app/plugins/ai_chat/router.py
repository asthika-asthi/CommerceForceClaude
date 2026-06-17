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
async def get_history(
    session_key: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    from sqlalchemy import select as sa_select
    from app.plugins.ai_chat.models import ChatSession
    result = await db.execute(sa_select(ChatSession).where(ChatSession.session_key == session_key))
    session = result.scalar_one_or_none()
    if session and session.user_id:
        if not current_user or str(current_user.id) != session.user_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Access denied")
    return await service.get_history(session_key, db)
