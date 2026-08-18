"""add catalogue_url to branding_config

Revision ID: 825b39751807
Revises: 2fa7c1d3e5b9
Create Date: 2026-08-18
"""
from alembic import op
import sqlalchemy as sa

revision = '825b39751807'
down_revision = '2fa7c1d3e5b9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.add_column(sa.Column('catalogue_url', sa.String(length=2048), nullable=True))


def downgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('catalogue_url')
