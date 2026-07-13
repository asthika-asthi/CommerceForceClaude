"""add stock_quantity to product_variants

Revision ID: e5f6a7b8c9d0
Revises: d7e8f9a0b1c2
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6a7b8c9d0'
down_revision = 'd7e8f9a0b1c2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('product_variants') as batch_op:
        batch_op.add_column(sa.Column('stock_quantity', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    with op.batch_alter_table('product_variants') as batch_op:
        batch_op.drop_column('stock_quantity')
