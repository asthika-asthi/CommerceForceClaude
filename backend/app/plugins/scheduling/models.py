import enum
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Table,
    Text,
    Time,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import Base, BaseModel


class AppointmentStatus(str, enum.Enum):
    requested = "requested"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


scheduling_provider_types = Table(
    "scheduling_provider_types",
    Base.metadata,
    Column(
        "provider_id",
        String(36),
        ForeignKey("scheduling_providers.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "appointment_type_id",
        String(36),
        ForeignKey("scheduling_appointment_types.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Provider(BaseModel):
    __tablename__ = "scheduling_providers"

    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    specialty: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    can_view_all_clients: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    availability: Mapped[list["ProviderAvailability"]] = relationship(
        "ProviderAvailability", back_populates="provider", cascade="all, delete-orphan", lazy="selectin"
    )
    exceptions: Mapped[list["AvailabilityException"]] = relationship(
        "AvailabilityException", back_populates="provider", cascade="all, delete-orphan", lazy="selectin"
    )
    # lazy="selectin" eager-loads only the first hop from a query root; nested two-hop
    # access (provider.appointment_types[].providers) needs explicit selectinload() at the
    # query site to avoid MissingGreenlet in async.
    appointment_types: Mapped[list["AppointmentType"]] = relationship(
        "AppointmentType", secondary=scheduling_provider_types, back_populates="providers", lazy="selectin"
    )


class AppointmentType(BaseModel):
    __tablename__ = "scheduling_appointment_types"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # lazy="selectin" eager-loads only the first hop from a query root; nested two-hop
    # access (appointment_type.providers[].appointment_types) needs explicit selectinload()
    # at the query site to avoid MissingGreenlet in async.
    providers: Mapped[list["Provider"]] = relationship(
        "Provider", secondary=scheduling_provider_types, back_populates="appointment_types", lazy="selectin"
    )


class ProviderAvailability(BaseModel):
    __tablename__ = "scheduling_availability"

    provider_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scheduling_providers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    provider: Mapped["Provider"] = relationship("Provider", back_populates="availability", lazy="selectin")


class AvailabilityException(BaseModel):
    __tablename__ = "scheduling_availability_exceptions"

    provider_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scheduling_providers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False)
    start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)

    provider: Mapped["Provider"] = relationship("Provider", back_populates="exceptions", lazy="selectin")


class Client(BaseModel):
    __tablename__ = "scheduling_clients"

    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    custom_fields: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Deliberately NOT lazy="selectin": Appointment.client is selectin, so eager-loading
    # these collections here would mean every appointment/journal list query also
    # pulls each client's ENTIRE appointment history + all journal entries — an
    # unbounded cascade. Nothing in this plugin accesses these collections lazily
    # (journal_service and service.py always query explicitly), so plain lazy="select"
    # is safe; if a future call site needs them, use an explicit selectinload() there.
    appointments: Mapped[list["Appointment"]] = relationship(
        "Appointment", back_populates="client", cascade="all, delete-orphan"
    )
    journal_entries: Mapped[list["JournalEntry"]] = relationship(
        "JournalEntry", back_populates="client", cascade="all, delete-orphan"
    )


class Appointment(BaseModel):
    __tablename__ = "scheduling_appointments"
    # Task 10: DB-enforced last line of defense against double-booking. The
    # application-level guard in service.create_appointment (lock provider row +
    # overlap check) is not sufficient when two requests use SEPARATE DB sessions
    # (e.g. on SQLite, with_for_update() is a no-op), so both can pass the overlap
    # check before either commits. This unique index makes the DB itself reject
    # the second insert for the exact-same-slot case; service.py catches the
    # resulting IntegrityError and converts it to the same 409 response.
    # It is PARTIAL (excludes cancelled rows) so that cancelling a booking frees
    # its exact start_at back up for re-booking, instead of permanently blocking
    # that slot — see test_can_rebook_cancelled_slot in test_scheduling.py.
    __table_args__ = (
        Index(
            "uq_scheduling_appt_provider_start_active",
            "provider_id", "start_at",
            unique=True,
            sqlite_where=text("status != 'cancelled'"),
            postgresql_where=text("status != 'cancelled'"),
        ),
    )

    provider_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scheduling_providers.id"), nullable=False, index=True
    )
    client_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scheduling_clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    appointment_type_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scheduling_appointment_types.id"), nullable=False, index=True
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(
        SAEnum(AppointmentStatus), default=AppointmentStatus.requested, nullable=False
    )
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    booked_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    provider: Mapped["Provider"] = relationship("Provider", lazy="selectin")
    client: Mapped["Client"] = relationship("Client", back_populates="appointments", lazy="selectin")
    appointment_type: Mapped["AppointmentType"] = relationship("AppointmentType", lazy="selectin")


class JournalEntry(BaseModel):
    __tablename__ = "scheduling_journal_entries"

    client_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scheduling_clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Nullable: a superadmin acting outside the treating-provider relationship
    # (see journal_service.assert_can_access_client_journal) authors entries with
    # no provider attribution rather than falsely attributing them to a provider
    # who didn't write them.
    provider_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("scheduling_providers.id"), nullable=True, index=True
    )
    appointment_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("scheduling_appointments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    template: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True, index=True
    )

    client: Mapped["Client"] = relationship("Client", back_populates="journal_entries", lazy="selectin")


class NoteAccessLog(BaseModel):
    __tablename__ = "scheduling_note_access_log"

    journal_entry_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("scheduling_journal_entries.id", ondelete="SET NULL"), nullable=True, index=True
    )
    client_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("scheduling_clients.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
