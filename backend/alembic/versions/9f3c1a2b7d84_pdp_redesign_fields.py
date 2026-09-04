"""add product short_description/specifications and branding legal + delivery fields

Revision ID: 9f3c1a2b7d84
Revises: f1a2b3c4d5e6
Create Date: 2026-09-04
"""
from alembic import op
import sqlalchemy as sa

revision = '9f3c1a2b7d84'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('products') as batch_op:
        batch_op.add_column(sa.Column('short_description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column(
            'specifications', sa.JSON(), nullable=False, server_default='[]'
        ))

    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.add_column(sa.Column('company_number', sa.String(100), nullable=True))
        batch_op.add_column(sa.Column('vat_number', sa.String(100), nullable=True))
        batch_op.add_column(sa.Column('eori_number', sa.String(100), nullable=True))
        batch_op.add_column(sa.Column('trademark_number', sa.String(100), nullable=True))
        batch_op.add_column(sa.Column('delivery_promo_text', sa.String(500), nullable=True))
        batch_op.add_column(sa.Column('dispatch_days', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('transit_days_min', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('transit_days_max', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('branding_config') as batch_op:
        batch_op.drop_column('transit_days_max')
        batch_op.drop_column('transit_days_min')
        batch_op.drop_column('dispatch_days')
        batch_op.drop_column('delivery_promo_text')
        batch_op.drop_column('trademark_number')
        batch_op.drop_column('eori_number')
        batch_op.drop_column('vat_number')
        batch_op.drop_column('company_number')

    with op.batch_alter_table('products') as batch_op:
        batch_op.drop_column('specifications')
        batch_op.drop_column('short_description')
