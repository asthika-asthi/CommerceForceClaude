"""add shipping_zones table and shipping_cost to orders

Revision ID: a1b2c3d4e5f6
Revises: c1d2e3f4a5b6
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'e3f4a5b6c7d8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'shipping_zones',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('countries', sa.Text, nullable=False),
        sa.Column('flat_rate', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    with op.batch_alter_table('orders') as batch_op:
        batch_op.add_column(sa.Column('shipping_cost', sa.Numeric(12, 2), nullable=False, server_default='0'))


def downgrade():
    with op.batch_alter_table('orders') as batch_op:
        batch_op.drop_column('shipping_cost')
    op.drop_table('shipping_zones')
