from typing import Optional, List
from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class CategoryOut(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    image_url: Optional[str] = None
    is_active: bool
    sort_order: int
    children: List["CategoryOut"] = []

    model_config = {"from_attributes": True}


CategoryOut.model_rebuild()
