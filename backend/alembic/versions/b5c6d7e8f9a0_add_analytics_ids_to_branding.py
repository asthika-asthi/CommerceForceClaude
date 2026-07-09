"""add ga4_measurement_id and meta_pixel_id to branding_config

Revision ID: b5c6d7e8f9a0
Revises: a3b4c5d6e7f8
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'b5c6d7e8f9a0'
down_revision = 'a3b4c5d6e7f8'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.add_column(sa.Column('ga4_measurement_id', sa.String(50), nullable=True))
        batch_op.add_column(sa.Column('meta_pixel_id', sa.String(50), nullable=True))


def downgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('meta_pixel_id')
        batch_op.drop_column('ga4_measurement_id')
