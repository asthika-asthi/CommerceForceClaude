from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class EnquiryCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    subject: Optional[str] = None
    message: str


class BespokeCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    message: str
    material_type: Optional[str] = None
    quantity_description: Optional[str] = None
    size_spec: Optional[str] = None
    deadline: Optional[str] = None


class EnquiryOut(BaseModel):
    id: str
    enquiry_type: str
    name: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    subject: Optional[str] = None
    message: str
    material_type: Optional[str] = None
    quantity_description: Optional[str] = None
    size_spec: Optional[str] = None
    deadline: Optional[str] = None
    is_read: bool
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}
