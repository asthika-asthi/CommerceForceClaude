"""add unique constraint to chat_sessions.session_key

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-06-17
"""
from alembic import op

revision = 'e3f4a5b6c7d8'
down_revision = 'd2e3f4a5b6c7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('chat_sessions') as batch_op:
        batch_op.create_unique_constraint('uq_chat_sessions_session_key', ['session_key'])


def downgrade():
    with op.batch_alter_table('chat_sessions') as batch_op:
        batch_op.drop_constraint('uq_chat_sessions_session_key', type_='unique')
