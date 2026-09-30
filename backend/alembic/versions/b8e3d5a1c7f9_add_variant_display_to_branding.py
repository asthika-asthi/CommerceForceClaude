"""variant display style: product-page variant options as drop-down or buttons

- branding_config.variant_display   'dropdown' (default) | 'buttons'

Revision ID: b8e3d5a1c7f9
Revises: f1c5a7d3b9e4
Create Date: 2026-09-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'b8e3d5a1c7f9'
down_revision = 'f1c5a7d3b9e4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.add_column(
            sa.Column('variant_display', sa.String(length=20), nullable=False, server_default='dropdown')
        )


def downgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('variant_display')
