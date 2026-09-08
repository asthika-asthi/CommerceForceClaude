"""add bespoke-enquiry toggle and homepage hero heading to branding_config

Revision ID: 6cefac3bd81c
Revises: 7c2e4f8a1b95
Create Date: 2026-09-08
"""
from alembic import op
import sqlalchemy as sa

revision = '6cefac3bd81c'
down_revision = '7c2e4f8a1b95'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        # Off by default — a client opts in to the bespoke enquiry form.
        batch_op.add_column(sa.Column(
            'show_bespoke_enquiry', sa.Boolean(), nullable=False, server_default='0'
        ))
        # Homepage hero H1, split across two lines. Line 2 renders in the
        # brand-highlight colour; blank line 2 collapses to a single-line hero.
        batch_op.add_column(sa.Column('hero_heading', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('hero_heading_highlight', sa.String(length=200), nullable=True))


def downgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('hero_heading_highlight')
        batch_op.drop_column('hero_heading')
        batch_op.drop_column('show_bespoke_enquiry')
