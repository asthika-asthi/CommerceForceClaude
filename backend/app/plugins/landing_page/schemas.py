from typing import Literal
from pydantic import BaseModel


class EditableFieldOut(BaseModel):
    name: str
    label: str
    type: Literal["text", "image", "link"]
    value: str


class EditableSectionOut(BaseModel):
    section_key: str
    is_hidden: bool
    fields: list[EditableFieldOut]


class ContentOverrideSave(BaseModel):
    overrides: dict[str, str]
    is_hidden: bool = False


class ContentOverrideEntryOut(BaseModel):
    overrides: dict[str, str]
    is_hidden: bool
