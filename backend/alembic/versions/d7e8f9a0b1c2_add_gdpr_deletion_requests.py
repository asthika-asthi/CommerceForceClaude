"""add data_deletion_requests table and relax reviews.user_id

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'd7e8f9a0b1c2'
down_revision = 'c6d7e8f9a0b1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'data_deletion_requests',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('user_email_snapshot', sa.String(255), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reviewed_by', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('admin_notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_data_deletion_requests_user_id', 'data_deletion_requests', ['user_id'])

    # A GDPR account deletion unlinks the review's author but keeps the review's
    # public text — user_id must be nullable for that to be possible.
    with op.batch_alter_table('reviews') as batch_op:
        batch_op.alter_column('user_id', existing_type=sa.String(36), nullable=True)


def downgrade():
    with op.batch_alter_table('reviews') as batch_op:
        batch_op.alter_column('user_id', existing_type=sa.String(36), nullable=False)
    op.drop_index('ix_data_deletion_requests_user_id', table_name='data_deletion_requests')
    op.drop_table('data_deletion_requests')
