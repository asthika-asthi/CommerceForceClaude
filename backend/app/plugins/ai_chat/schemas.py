from typing import List, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_key: str = Field(..., min_length=1, max_length=255)
    # Kept for backward compatibility with existing clients; ignored when session_key is provided
    history: Optional[List[ChatMessage]] = None


class ChatResponse(BaseModel):
    reply: str
    session_key: str


class HistoryMessage(BaseModel):
    role: str
    content: str


class HistoryResponse(BaseModel):
    session_key: str
    messages: list[HistoryMessage]
