"""add email-code two-factor auth (users.is_2fa_enabled + two_factor_codes)

Revision ID: 2fa7c1d3e5b9
Revises: a9b8c7d6e5f4
Create Date: 2026-07-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '2fa7c1d3e5b9'
down_revision: Union[str, None] = 'a9b8c7d6e5f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column(
            'is_2fa_enabled', sa.Boolean(), nullable=False, server_default=sa.false()
        ))

    op.create_table(
        'two_factor_codes',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('code_hash', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_two_factor_codes_user_id', 'two_factor_codes', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_two_factor_codes_user_id', table_name='two_factor_codes')
    op.drop_table('two_factor_codes')
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('is_2fa_enabled')
