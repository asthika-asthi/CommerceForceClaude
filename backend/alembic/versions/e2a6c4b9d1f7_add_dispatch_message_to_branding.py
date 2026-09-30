"""homepage dispatch message: admin-editable title + subtitle

- branding_config.dispatch_title     default 'Same Day Despatch'
- branding_config.dispatch_subtitle  default 'Orders placed before 2pm'

Defaults reproduce the previously hardcoded homepage copy. An empty string
hides the message (for stores that can't promise same-day despatch).

Revision ID: e2a6c4b9d1f7
Revises: b8e3d5a1c7f9
Create Date: 2026-09-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'e2a6c4b9d1f7'
down_revision = 'b8e3d5a1c7f9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.add_column(sa.Column('dispatch_title', sa.String(length=100), nullable=False,
                                      server_default='Same Day Despatch'))
        batch_op.add_column(sa.Column('dispatch_subtitle', sa.String(length=200), nullable=False,
                                      server_default='Orders placed before 2pm'))


def downgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('dispatch_subtitle')
        batch_op.drop_column('dispatch_title')
