"""order-value delivery bands

- shipping_bands   global bands: orders worth at least min_order_value pay charge

Seeded with bands at 0 / 250 / 500. The charges are seeded at 0.00 on purpose:
delivery stays free until an admin enters the real amounts under
Settings -> Shipping, rather than guessing a charge customers would pay.

Revision ID: f1c5a7d3b9e4
Revises: e7b3c9d1a5f2
Create Date: 2026-09-30
"""
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

revision = 'f1c5a7d3b9e4'
down_revision = 'e7b3c9d1a5f2'
branch_labels = None
depends_on = None


def upgrade():
    table = op.create_table(
        'shipping_bands',
        sa.Column('min_order_value', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('charge', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(table, [
        {'id': str(uuid.uuid4()), 'min_order_value': mn, 'charge': 0, 'created_at': now, 'updated_at': now}
        for mn in (0, 250, 500)
    ])


def downgrade():
    op.drop_table('shipping_bands')
