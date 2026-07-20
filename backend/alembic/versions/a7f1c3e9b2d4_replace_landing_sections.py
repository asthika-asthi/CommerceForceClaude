"""replace landing_sections with landing_content_overrides

Revision ID: a7f1c3e9b2d4
Revises: e5f6a7b8c9d0
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = 'a7f1c3e9b2d4'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table('landing_sections')
    op.create_table(
        'landing_content_overrides',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('section_key', sa.String(length=100), nullable=False),
        sa.Column('overrides', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('is_hidden', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('section_key'),
    )


def downgrade():
    op.drop_table('landing_content_overrides')
    op.create_table(
        'landing_sections',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            'section_type',
            sa.Enum('hero', 'features', 'testimonials', 'cta', 'html', 'products', name='sectiontype'),
            nullable=False,
        ),
        sa.Column('title', sa.String(length=500), nullable=True),
        sa.Column('subtitle', sa.String(length=1000), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(length=2048), nullable=True),
        sa.Column('cta_text', sa.String(length=200), nullable=True),
        sa.Column('cta_url', sa.String(length=2048), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('background_color', sa.String(length=20), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
