"""add show_store_name toggle to branding_config

Revision ID: 3b7e1a9c2f04
Revises: 9f3c1a2b7d84
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa

revision = '3b7e1a9c2f04'
down_revision = '9f3c1a2b7d84'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.add_column(sa.Column(
            'show_store_name', sa.Boolean(), nullable=False, server_default='1'
        ))


def downgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('show_store_name')
