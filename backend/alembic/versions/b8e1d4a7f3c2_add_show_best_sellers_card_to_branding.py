"""add show_best_sellers_card toggle to branding_config

Off by default. The homepage hero "Best selling products" card badges its four
rows (Best seller / Trade fave / In stock / New range) purely by list position —
they are not backed by real sales or stock data. Until that is fixed (see
docs/backlog.md) the card is hidden unless a client opts in via Branding.

Revision ID: b8e1d4a7f3c2
Revises: 6cefac3bd81c
Create Date: 2026-09-08
"""
from alembic import op
import sqlalchemy as sa

revision = 'b8e1d4a7f3c2'
down_revision = '6cefac3bd81c'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.add_column(sa.Column(
            'show_best_sellers_card', sa.Boolean(), nullable=False, server_default='0'
        ))


def downgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('show_best_sellers_card')
