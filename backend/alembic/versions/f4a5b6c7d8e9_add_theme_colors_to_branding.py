"""add theme_colors to branding_config

Revision ID: f4a5b6c7d8e9
Revises: 808038705490
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa

revision = 'f4a5b6c7d8e9'
down_revision = '808038705490'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.add_column(sa.Column('theme_colors', sa.JSON(), nullable=False, server_default='{}'))


def downgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('theme_colors')
