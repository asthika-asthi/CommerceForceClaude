from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProviderCreate(BaseModel):
    display_name: str
    title: Optional[str] = None
    specialty: Optional[str] = None
    bio: Optional[str] = None
    color: Optional[str] = None
    user_id: Optional[str] = None
    can_view_all_clients: bool = False
    is_active: bool = True


class ProviderUpdate(BaseModel):
    display_name: Optional[str] = None
    title: Optional[str] = None
    specialty: Optional[str] = None
    bio: Optional[str] = None
    color: Optional[str] = None
    user_id: Optional[str] = None
    can_view_all_clients: Optional[bool] = None
    is_active: Optional[bool] = None


class ProviderOut(BaseModel):
    id: str
    display_name: str
    title: Optional[str] = None
    specialty: Optional[str] = None
    bio: Optional[str] = None
    color: Optional[str] = None
    user_id: Optional[str] = None
    can_view_all_clients: bool
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class ProviderListOut(BaseModel):
    id: str
    display_name: str
    title: Optional[str] = None
    specialty: Optional[str] = None
    is_active: bool
    model_config = {"from_attributes": True}
