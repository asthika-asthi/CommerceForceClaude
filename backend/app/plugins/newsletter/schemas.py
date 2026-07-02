from typing import Optional
from pydantic import BaseModel, EmailStr


class SubscribeRequest(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None


class UnsubscribeRequest(BaseModel):
    token: str


class SubscriberOut(BaseModel):
    id: str
    email: str
    first_name: Optional[str] = None
    is_active: bool
    model_config = {"from_attributes": True}


class SubscriberUpdate(BaseModel):
    first_name: Optional[str] = None
    is_active: Optional[bool] = None


class SubscribeResponse(BaseModel):
    message: str
    unsubscribe_token: str
