"""add barcode to products

Revision ID: f2a3b4c5d6e7
Revises: e2f3a4b5c6d7
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'f2a3b4c5d6e7'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('products') as batch_op:
        batch_op.add_column(sa.Column('barcode', sa.String(100), nullable=True))
        batch_op.create_index('ix_products_barcode', ['barcode'])


def downgrade():
    with op.batch_alter_table('products') as batch_op:
        batch_op.drop_index('ix_products_barcode')
        batch_op.drop_column('barcode')
