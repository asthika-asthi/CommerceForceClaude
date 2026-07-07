"""make scheduling_journal_entries.provider_id nullable

Task 12 (provider-scoped journals + audit log): a superadmin may author or
countersign a clinical note without being "the treating provider" — in that
case journal_service.create_journal_entry sets provider_id to None rather
than attributing the note to a provider who didn't write it. The column was
originally NOT NULL (see 62d9c03455e5); relax it here so that insert can
succeed.

Revision ID: 808038705490
Revises: 62d9c03455e5
Create Date: 2026-07-07
"""
from alembic import op
import sqlalchemy as sa

revision = '808038705490'
down_revision = '62d9c03455e5'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('scheduling_journal_entries') as batch_op:
        batch_op.alter_column('provider_id', existing_type=sa.String(36), nullable=True)


def downgrade():
    with op.batch_alter_table('scheduling_journal_entries') as batch_op:
        batch_op.alter_column('provider_id', existing_type=sa.String(36), nullable=False)
