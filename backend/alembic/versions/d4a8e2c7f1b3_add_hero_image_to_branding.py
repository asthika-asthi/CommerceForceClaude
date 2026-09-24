"""add hero_image_url and hero_image_alt to branding_config

Picture for the slanted panel on the right of the homepage hero. Both nullable;
empty keeps the historical plain brand-colour panel.

Revision ID: d4a8e2c7f1b3
Revises: c9f2a4d6e1b8
Create Date: 2026-09-24
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4a8e2c7f1b3'
down_revision = 'c9f2a4d6e1b8'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.add_column(sa.Column('hero_image_url', sa.String(length=2048), nullable=True))
        batch_op.add_column(sa.Column('hero_image_alt', sa.String(length=200), nullable=True))


def downgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('hero_image_alt')
        batch_op.drop_column('hero_image_url')
