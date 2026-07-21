"""add bank_transfer and paypal payment methods

Revision ID: a9b8c7d6e5f4
Revises: a7f1c3e9b2d4
Create Date: 2026-07-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a9b8c7d6e5f4'
down_revision: Union[str, None] = 'a7f1c3e9b2d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL: add new enum values (SQLite stores as VARCHAR, no-op needed)
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TYPE paymentmethod ADD VALUE IF NOT EXISTS 'bank_transfer'")
        op.execute("ALTER TYPE paymentmethod ADD VALUE IF NOT EXISTS 'paypal'")

    with op.batch_alter_table('orders') as batch_op:
        batch_op.add_column(sa.Column('pending_coupon_code', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column(
            'pending_redeem_points', sa.Integer(), nullable=False, server_default='0'
        ))

    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.add_column(sa.Column('bank_transfer_details', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('paypal_email', sa.String(length=255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('paypal_email')
        batch_op.drop_column('bank_transfer_details')

    with op.batch_alter_table('orders') as batch_op:
        batch_op.drop_column('pending_redeem_points')
        batch_op.drop_column('pending_coupon_code')

    # PostgreSQL cannot remove enum values; SQLite: no-op
