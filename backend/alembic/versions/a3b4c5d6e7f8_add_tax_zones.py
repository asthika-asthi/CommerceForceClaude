"""add tax_zones table

Revision ID: a3b4c5d6e7f8
Revises: f4a5b6c7d8e9
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'a3b4c5d6e7f8'
down_revision = 'f4a5b6c7d8e9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tax_zones',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('countries', sa.Text, nullable=False),
        sa.Column('rate_percent', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table('tax_zones')
