"""Provider-scoped clinical journal (Task 12).

Access control: a `Provider` may only read/write journal entries for a `Client`
they have a real relationship with (an appointment together, or having authored
a prior entry for that client) — UNLESS `Provider.can_view_all_clients` is set.
A `superadmin` bypasses provider scoping entirely. An ordinary admin who is not
linked to any `Provider` record cannot access clinical notes at all.

Every read (list + single get), create, and edit writes a `NoteAccessLog` row —
this is a HIPAA-style audit trail and is not optional.
"""
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.plugins.scheduling.models import Appointment, JournalEntry, NoteAccessLog, Provider
from app.plugins.scheduling.schemas import JournalEntryCreate, JournalEntryUpdate
from app.plugins.scheduling.service import get_client
from app.plugins.scheduling.templates import NOTE_TEMPLATES, list_note_template_names


async def _get_provider_for_user(user_id: str, db: AsyncSession) -> Optional[Provider]:
    result = await db.execute(select(Provider).where(Provider.user_id == user_id))
    return result.scalar_one_or_none()


async def _provider_related_to_client(provider_id: str, client_id: str, db: AsyncSession) -> bool:
    appt_result = await db.execute(
        select(Appointment.id).where(
            Appointment.provider_id == provider_id, Appointment.client_id == client_id
        )
    )
    if appt_result.first() is not None:
        return True

    entry_result = await db.execute(
        select(JournalEntry.id).where(
            JournalEntry.provider_id == provider_id, JournalEntry.client_id == client_id
        )
    )
    return entry_result.first() is not None


async def assert_can_access_client_journal(
    user, client_id: str, db: AsyncSession
) -> Optional[Provider]:
    """Raise 403 if `user` may not access `client_id`'s journal; else return the
    resolved Provider (or None when acting as superadmin)."""
    if user.role == "superadmin":
        return None

    provider = await _get_provider_for_user(user.id, db)
    if provider is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="not authorized to access clinical notes"
        )

    if provider.can_view_all_clients:
        return provider

    if await _provider_related_to_client(provider.id, client_id, db):
        return provider

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, detail="not authorized to access clinical notes"
    )


async def _log_access(
    db: AsyncSession,
    *,
    user_id: str,
    action: str,
    client_id: Optional[str] = None,
    journal_entry_id: Optional[str] = None,
) -> None:
    log = NoteAccessLog(
        journal_entry_id=journal_entry_id,
        client_id=client_id,
        user_id=user_id,
        action=action,
    )
    db.add(log)
    await db.flush()


def _validate_content(template_name: str, content: dict[str, Any]) -> None:
    template = NOTE_TEMPLATES.get(template_name)
    if template is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown note template")

    expected_keys = {field["key"] for field in template["fields"]}
    given_keys = set(content.keys())

    missing = expected_keys - given_keys
    unknown = given_keys - expected_keys
    if missing or unknown:
        parts = []
        if missing:
            parts.append(f"missing field(s): {', '.join(sorted(missing))}")
        if unknown:
            parts.append(f"unknown field(s): {', '.join(sorted(unknown))}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"content does not match template '{template_name}': {'; '.join(parts)}",
        )


async def list_client_journal(user, client_id: str, db: AsyncSession) -> list[JournalEntry]:
    await assert_can_access_client_journal(user, client_id, db)
    await get_client(client_id, db)

    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.client_id == client_id)
        .order_by(JournalEntry.created_at.desc())
    )
    entries = list(result.scalars().all())

    await _log_access(db, user_id=user.id, action="view", client_id=client_id)
    return entries


async def create_journal_entry(
    user, client_id: str, data: JournalEntryCreate, db: AsyncSession
) -> JournalEntry:
    provider = await assert_can_access_client_journal(user, client_id, db)
    await get_client(client_id, db)

    if data.template not in list_note_template_names():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown note template")
    _validate_content(data.template, data.content)

    entry = JournalEntry(
        client_id=client_id,
        provider_id=provider.id if provider is not None else None,
        appointment_id=data.appointment_id,
        template=data.template,
        content=data.content,
        created_by=user.id,
    )
    db.add(entry)
    await db.flush()

    await _log_access(db, user_id=user.id, action="create", client_id=client_id, journal_entry_id=entry.id)
    return entry


async def _get_journal_entry_raw(entry_id: str, db: AsyncSession) -> JournalEntry:
    result = await db.execute(select(JournalEntry).where(JournalEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")
    return entry


async def get_journal_entry(user, entry_id: str, db: AsyncSession) -> JournalEntry:
    entry = await _get_journal_entry_raw(entry_id, db)
    await assert_can_access_client_journal(user, entry.client_id, db)

    await _log_access(db, user_id=user.id, action="view", client_id=entry.client_id, journal_entry_id=entry.id)
    return entry


async def update_journal_entry(
    user, entry_id: str, data: JournalEntryUpdate, db: AsyncSession
) -> JournalEntry:
    entry = await _get_journal_entry_raw(entry_id, db)
    await assert_can_access_client_journal(user, entry.client_id, db)

    _validate_content(entry.template, data.content)
    entry.content = data.content
    await db.flush()

    await _log_access(db, user_id=user.id, action="edit", client_id=entry.client_id, journal_entry_id=entry.id)
    return entry


async def list_audit(db: AsyncSession, page: int, page_size: int) -> tuple[list[NoteAccessLog], int]:
    from sqlalchemy import func

    count_query = select(func.count()).select_from(NoteAccessLog)
    total = (await db.execute(count_query)).scalar_one()

    query = (
        select(NoteAccessLog)
        .order_by(NoteAccessLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total
