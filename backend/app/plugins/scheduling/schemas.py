from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, model_validator


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


# ── APPOINTMENT TYPES ───────────────────────────────────────────────────────────

class ProviderRef(BaseModel):
    id: str
    display_name: str
    model_config = {"from_attributes": True}


class AppointmentTypeCreate(BaseModel):
    name: str
    duration_minutes: int
    description: Optional[str] = None
    price: Optional[Decimal] = None
    color: Optional[str] = None
    is_active: bool = True
    provider_ids: Optional[list[str]] = None


class AppointmentTypeUpdate(BaseModel):
    name: Optional[str] = None
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    provider_ids: Optional[list[str]] = None


class AppointmentTypeOut(BaseModel):
    id: str
    name: str
    duration_minutes: int
    description: Optional[str] = None
    price: Optional[Decimal] = None
    color: Optional[str] = None
    is_active: bool
    created_at: datetime
    providers: list[ProviderRef] = []
    model_config = {"from_attributes": True}


class AppointmentTypeListOut(BaseModel):
    id: str
    name: str
    duration_minutes: int
    price: Optional[Decimal] = None
    is_active: bool
    model_config = {"from_attributes": True}


# ── PROVIDER AVAILABILITY (Task 6) ──────────────────────────────────────────────

class AvailabilityCreate(BaseModel):
    weekday: int
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def _validate_weekday_and_range(self) -> "AvailabilityCreate":
        if not 0 <= self.weekday <= 6:
            raise ValueError("weekday must be between 0 and 6")
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class AvailabilityOut(BaseModel):
    id: str
    provider_id: str
    weekday: int
    start_time: time
    end_time: time
    model_config = {"from_attributes": True}


class ExceptionCreate(BaseModel):
    date: date
    is_available: bool
    start_time: Optional[time] = None
    end_time: Optional[time] = None

    @model_validator(mode="after")
    def _validate_times(self) -> "ExceptionCreate":
        if self.is_available and (self.start_time is None or self.end_time is None):
            raise ValueError("start_time and end_time are required when is_available is True")
        if not self.is_available and (self.start_time is None) != (self.end_time is None):
            raise ValueError(
                "when is_available is False, provide both start_time and end_time or neither"
            )
        if self.start_time is not None and self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class ExceptionOut(BaseModel):
    id: str
    provider_id: str
    date: date
    is_available: bool
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    model_config = {"from_attributes": True}


# ── OPEN SLOT COMPUTATION (Task 7) ──────────────────────────────────────────────

class SlotsOut(BaseModel):
    slots: list[datetime]
