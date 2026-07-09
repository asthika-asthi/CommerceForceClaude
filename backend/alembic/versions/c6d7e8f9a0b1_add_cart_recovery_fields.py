"""add recovery_email and reminder_sent_at to carts

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'c6d7e8f9a0b1'
down_revision = 'b5c6d7e8f9a0'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('carts') as batch_op:
        batch_op.add_column(sa.Column('recovery_email', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('reminder_sent_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    with op.batch_alter_table('carts') as batch_op:
        batch_op.drop_column('reminder_sent_at')
        batch_op.drop_column('recovery_email')
