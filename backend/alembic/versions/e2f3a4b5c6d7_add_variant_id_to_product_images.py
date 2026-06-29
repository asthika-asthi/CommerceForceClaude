"""add variant_id to product_images

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa

revision = 'e2f3a4b5c6d7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('product_images', schema=None) as batch_op:
        batch_op.add_column(sa.Column('variant_id', sa.String(36), nullable=True))
        batch_op.create_index('ix_product_images_variant_id', ['variant_id'])


def downgrade():
    with op.batch_alter_table('product_images', schema=None) as batch_op:
        batch_op.drop_index('ix_product_images_variant_id')
        batch_op.drop_column('variant_id')
