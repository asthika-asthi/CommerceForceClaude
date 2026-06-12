"""add block section type

Revision ID: f3e2d1c0b9a8
Revises: 3c0a6bde54df
Create Date: 2026-06-13

"""
from alembic import op

revision = 'f3e2d1c0b9a8'
down_revision = '3c0a6bde54df'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL: add new enum value (SQLite stores as VARCHAR, no-op needed)
    import sqlalchemy as sa
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TYPE sectiontype ADD VALUE IF NOT EXISTS 'block'")


def downgrade() -> None:
    pass  # PostgreSQL cannot remove enum values; SQLite: no-op
