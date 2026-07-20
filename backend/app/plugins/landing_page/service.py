import re
from typing import Any
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.landing_config import get_editable_section_defs
from app.plugins.landing_page.models import LandingContentOverride


def humanize_field_name(name: str) -> str:
    """'bgImageSrc' -> 'Bg Image Src'. No hand-maintained label list to drift."""
    spaced = re.sub(r"(?<!^)(?=[A-Z])", " ", name)
    spaced = spaced.replace("_", " ")
    return spaced.strip().title()


def infer_field_type(field_name: str) -> str:
    lname = field_name.lower()
    if any(token in lname for token in ("image", "logo", "photo", "avatar", "icon")) or lname.endswith("src"):
        return "image"
    if lname.endswith("url") or lname.endswith("href"):
        return "link"
    return "text"


async def get_editable_sections(db: AsyncSession) -> list[dict[str, Any]]:
    defs = get_editable_section_defs()
    result = await db.execute(select(LandingContentOverride))
    override_rows = {row.section_key: row for row in result.scalars().all()}

    sections_out = []
    for d in defs:
        section = d["section"]
        override_row = override_rows.get(d["section_key"])
        saved_overrides = override_row.overrides if override_row else {}
        is_hidden = override_row.is_hidden if override_row else False

        fields_out = []
        for field_name in d["editable_fields"]:
            base_value = section.get(field_name)
            if not isinstance(base_value, str):
                continue  # unknown/non-text field named in the config — skip silently
            current_value = saved_overrides.get(field_name, base_value)
            fields_out.append({
                "name": field_name,
                "label": humanize_field_name(field_name),
                "type": infer_field_type(field_name),
                "value": current_value,
            })

        sections_out.append({
            "section_key": d["section_key"],
            "is_hidden": is_hidden,
            "fields": fields_out,
        })
    return sections_out


async def get_override_map(db: AsyncSession) -> dict[str, dict[str, Any]]:
    result = await db.execute(select(LandingContentOverride))
    return {
        row.section_key: {"overrides": row.overrides, "is_hidden": row.is_hidden}
        for row in result.scalars().all()
    }


async def save_override(
    db: AsyncSession, section_key: str, overrides: dict[str, str], is_hidden: bool
) -> LandingContentOverride:
    """Fully replaces this section's overrides and is_hidden — not a merge. Callers must
    resend the complete current field set on every save."""
    defs = {d["section_key"]: d["editable_fields"] for d in get_editable_section_defs()}
    if section_key not in defs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section is not editable")

    allowed_fields = set(defs[section_key])
    unknown = set(overrides.keys()) - allowed_fields
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Field(s) not editable on this section: {', '.join(sorted(unknown))}",
        )

    result = await db.execute(
        select(LandingContentOverride).where(LandingContentOverride.section_key == section_key)
    )
    row = result.scalar_one_or_none()
    if row is None:
        try:
            async with db.begin_nested():
                row = LandingContentOverride(section_key=section_key, overrides=overrides, is_hidden=is_hidden)
                db.add(row)
                await db.flush()
        except IntegrityError:
            # Another request created this section's row concurrently — load it and
            # apply this request's values (full-replace semantics, same as the update branch).
            result = await db.execute(
                select(LandingContentOverride).where(LandingContentOverride.section_key == section_key)
            )
            row = result.scalar_one()
            row.overrides = overrides
            row.is_hidden = is_hidden
    else:
        row.overrides = overrides
        row.is_hidden = is_hidden
    await db.commit()
    await db.refresh(row)
    return row
