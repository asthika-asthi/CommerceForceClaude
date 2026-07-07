from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, model_validator

from app.plugins.scheduling.models import AppointmentStatus


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


class PublicAppointmentTypeOut(BaseModel):
    id: str
    name: str
    duration_minutes: int
    description: Optional[str] = None
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


# ── CLIENTS (Task 8) ────────────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    custom_fields: dict[str, Any] = {}
    user_id: Optional[str] = None


class ClientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    custom_fields: Optional[dict[str, Any]] = None
    user_id: Optional[str] = None
    is_active: Optional[bool] = None


class ClientOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    user_id: Optional[str] = None
    custom_fields: dict[str, Any]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class ClientListOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    model_config = {"from_attributes": True}


class ClientSelfUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    custom_fields: Optional[dict[str, Any]] = None


# ── APPOINTMENT BOOKING + LIFECYCLE (Task 9) ────────────────────────────────────

class AppointmentCreate(BaseModel):
    provider_id: str
    appointment_type_id: str
    start_at: datetime
    reason: Optional[str] = None

    # Admin path: book for an existing client record.
    client_id: Optional[str] = None

    # Guest / self path: identity details (ignored for logged-in-customer bookings,
    # which always resolve to the caller's own client record).
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class AppointmentOut(BaseModel):
    id: str
    provider_id: str
    client_id: str
    appointment_type_id: str
    start_at: datetime
    end_at: datetime
    status: AppointmentStatus
    reason: Optional[str] = None
    booked_by: Optional[str] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
    provider_name: Optional[str] = None
    client_name: Optional[str] = None
    appointment_type_name: Optional[str] = None
    model_config = {"from_attributes": True}


class AppointmentListOut(BaseModel):
    id: str
    start_at: datetime
    end_at: datetime
    status: AppointmentStatus
    provider_name: Optional[str] = None
    client_name: Optional[str] = None
    appointment_type_name: Optional[str] = None
    model_config = {"from_attributes": True}


class RescheduleRequest(BaseModel):
    start_at: datetime


class StatusChangeRequest(BaseModel):
    status: AppointmentStatus
    cancellation_reason: Optional[str] = None


class CancelRequest(BaseModel):
    cancellation_reason: Optional[str] = None


# ── PROVIDER-SCOPED JOURNAL + AUDIT LOG (Task 12) ───────────────────────────────

class JournalEntryCreate(BaseModel):
    template: str
    content: dict[str, Any]
    appointment_id: Optional[str] = None


class JournalEntryUpdate(BaseModel):
    content: dict[str, Any]


class JournalEntryOut(BaseModel):
    id: str
    client_id: str
    provider_id: Optional[str] = None
    appointment_id: Optional[str] = None
    template: str
    content: dict[str, Any]
    created_by: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class JournalEntryListOut(BaseModel):
    id: str
    client_id: str
    provider_id: Optional[str] = None
    template: str
    created_by: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class NoteAccessLogOut(BaseModel):
    id: str
    journal_entry_id: Optional[str] = None
    client_id: Optional[str] = None
    user_id: str
    action: str
    created_at: datetime
    model_config = {"from_attributes": True}
