from typing import Optional
from pydantic import BaseModel


class AddressBase(BaseModel):
    label: Optional[str] = None
    line1: str
    line2: Optional[str] = None
    city: str
    county: Optional[str] = None
    postcode: str
    country: str = "GB"
    is_default: bool = False


class AddressCreate(AddressBase):
    pass


class AddressUpdate(BaseModel):
    label: Optional[str] = None
    line1: Optional[str] = None
    line2: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    postcode: Optional[str] = None
    country: Optional[str] = None
    is_default: Optional[bool] = None


class AddressOut(AddressBase):
    id: str
    user_id: str

    model_config = {"from_attributes": True}
