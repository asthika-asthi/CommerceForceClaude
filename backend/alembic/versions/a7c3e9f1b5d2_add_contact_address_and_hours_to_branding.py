"""branding: admin-editable contact address and opening hours

- branding_config.contact_address  nullable, shown on the Contact page + legal pages
- branding_config.opening_hours    nullable, shown on the Contact page

These were hardcoded in the storefront. Existing rows are backfilled with the
previously hardcoded text so the live pages don't change until an admin edits them.

Revision ID: a7c3e9f1b5d2
Revises: e2a6c4b9d1f7
Create Date: 2026-10-05
"""
from alembic import op
import sqlalchemy as sa

revision = 'a7c3e9f1b5d2'
down_revision = 'e2a6c4b9d1f7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.add_column(sa.Column('contact_address', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('opening_hours', sa.String(length=100), nullable=True))
    op.execute(
        "UPDATE branding_config SET contact_address = 'Stevenage, Hertfordshire', "
        "opening_hours = 'Mon–Fri  8:30 am – 5:00 pm'"
    )


def downgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('opening_hours')
        batch_op.drop_column('contact_address')
