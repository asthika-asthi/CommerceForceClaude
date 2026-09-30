"""parcel weight tracking: variant weight override, shipping default weight, order weight

- product_variants.weight      kg, nullable (None = inherit the product's weight)
- shipping_settings            single row; default_weight_kg for items with no weight
- orders.total_weight_kg       parcel weight the delivery charge was quoted on

Revision ID: e7b3c9d1a5f2
Revises: d4a8e2c7f1b3
Create Date: 2026-09-24
"""
from alembic import op
import sqlalchemy as sa

revision = 'e7b3c9d1a5f2'
down_revision = 'd4a8e2c7f1b3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('product_variants') as batch_op:
        batch_op.add_column(sa.Column('weight', sa.Numeric(precision=8, scale=3), nullable=True))

    with op.batch_alter_table('orders') as batch_op:
        batch_op.add_column(sa.Column('total_weight_kg', sa.Numeric(precision=10, scale=3), nullable=True))

    op.create_table(
        'shipping_settings',
        sa.Column('default_weight_kg', sa.Numeric(precision=8, scale=3), nullable=False, server_default='1.000'),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('shipping_settings')
    with op.batch_alter_table('orders') as batch_op:
        batch_op.drop_column('total_weight_kg')
    with op.batch_alter_table('product_variants') as batch_op:
        batch_op.drop_column('weight')
