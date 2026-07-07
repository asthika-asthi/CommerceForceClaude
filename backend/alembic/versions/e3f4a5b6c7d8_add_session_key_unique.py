"""add unique constraint to chat_sessions.session_key

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-06-17

NOTE: this migration originally added a redundant unique CONSTRAINT on top of
the non-unique index that d2e3f4a5b6c7 created on chat_sessions.session_key.
That left a fresh `alembic upgrade head` with both a duplicate index and a
unique constraint, whereas the ChatSession model (unique=True, index=True)
and create_all produce exactly ONE unique index
(`ix_chat_sessions_session_key`). d2e3f4a5b6c7 now creates that index as
unique directly, so this revision is a no-op kept only to preserve the
migration chain (it is referenced as a merge parent by a0b1c2d3e4f5). No
deployed DB ever ran this chain (deploys use init_db.py + `alembic stamp
head`), so downgrading this to a no-op is safe.
"""
from alembic import op  # noqa: F401

revision = 'e3f4a5b6c7d8'
down_revision = 'd2e3f4a5b6c7'
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
