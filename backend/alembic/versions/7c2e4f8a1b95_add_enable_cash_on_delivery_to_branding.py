"""add enable_cash_on_delivery toggle to branding_config

Revision ID: 7c2e4f8a1b95
Revises: 3b7e1a9c2f04
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa

revision = '7c2e4f8a1b95'
down_revision = '3b7e1a9c2f04'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.add_column(sa.Column(
            'enable_cash_on_delivery', sa.Boolean(), nullable=False, server_default='1'
        ))


def downgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('enable_cash_on_delivery')
