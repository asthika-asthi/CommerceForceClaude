"""add direct_price to product_variants and sale_percent to products

Adds the storage needed for two new store-wide, config-driven pricing options
(VARIANT_PRICING_MODE and SALE_PRICE_MODE in app.core.config): a variant may
carry an absolute direct_price alongside its existing price_adjustment, and a
product may carry a sale_percent alongside its existing sale_price. Both
columns are nullable and unused unless the corresponding setting is switched
on for a deployment, so this is fully backward compatible with zero backfill.

Revision ID: f1a2b3c4d5e6
Revises: 825b39751807
Create Date: 2026-08-27
"""
from alembic import op
import sqlalchemy as sa


revision = 'f1a2b3c4d5e6'
down_revision = '825b39751807'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('product_variants') as batch_op:
        batch_op.add_column(
            sa.Column('direct_price', sa.Numeric(12, 2), nullable=True)
        )
    with op.batch_alter_table('products') as batch_op:
        batch_op.add_column(
            sa.Column('sale_percent', sa.Numeric(5, 2), nullable=True)
        )


def downgrade():
    with op.batch_alter_table('products') as batch_op:
        batch_op.drop_column('sale_percent')
    with op.batch_alter_table('product_variants') as batch_op:
        batch_op.drop_column('direct_price')
