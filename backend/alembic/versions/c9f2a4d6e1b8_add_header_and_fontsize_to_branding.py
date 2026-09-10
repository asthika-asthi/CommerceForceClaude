"""add base_font_size, header_size and header look-and-feel toggles to branding_config

All default to the historical appearance:
  base_font_size = 'default'   (16px root)
  header_size    = 'standard'  (72px navbar)
  header_elevated / header_filled / header_shrink_on_scroll = off

Revision ID: c9f2a4d6e1b8
Revises: b8e1d4a7f3c2
Create Date: 2026-09-10
"""
from alembic import op
import sqlalchemy as sa

revision = 'c9f2a4d6e1b8'
down_revision = 'b8e1d4a7f3c2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.add_column(sa.Column(
            'base_font_size', sa.String(length=20), nullable=False, server_default='default'
        ))
        batch_op.add_column(sa.Column(
            'header_size', sa.String(length=20), nullable=False, server_default='standard'
        ))
        batch_op.add_column(sa.Column(
            'header_elevated', sa.Boolean(), nullable=False, server_default='0'
        ))
        batch_op.add_column(sa.Column(
            'header_filled', sa.Boolean(), nullable=False, server_default='0'
        ))
        batch_op.add_column(sa.Column(
            'header_shrink_on_scroll', sa.Boolean(), nullable=False, server_default='0'
        ))


def downgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('header_shrink_on_scroll')
        batch_op.drop_column('header_filled')
        batch_op.drop_column('header_elevated')
        batch_op.drop_column('header_size')
        batch_op.drop_column('base_font_size')
