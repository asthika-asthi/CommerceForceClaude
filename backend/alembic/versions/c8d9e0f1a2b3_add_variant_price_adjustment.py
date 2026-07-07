"""add price_adjustment to product_variants

Revision ID: c8d9e0f1a2b3
Revises: a0b1c2d3e4f5
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa


revision = 'c8d9e0f1a2b3'
down_revision = 'a0b1c2d3e4f5'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('product_variants') as batch_op:
        batch_op.add_column(
            sa.Column('price_adjustment', sa.Numeric(12, 2), nullable=True)
        )


def downgrade():
    with op.batch_alter_table('product_variants') as batch_op:
        batch_op.drop_column('price_adjustment')
