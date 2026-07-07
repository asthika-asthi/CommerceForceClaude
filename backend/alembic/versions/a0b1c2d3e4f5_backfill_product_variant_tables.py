"""backfill product-variant tables (product_variants, product_option_types,
product_option_values, product_variant_options) and reshape cart_items /
order_items / warehouse_stock to reference variants instead of products.

Why this migration exists: the four product-variant tables were historically
created out-of-band via Base.metadata.create_all and never went through a
migration, so `alembic upgrade head` failed on a fresh empty database with
"no such table: product_variants" once it reached c8d9e0f1a2b3 (which only
ALTERs product_variants to add price_adjustment). This migration is inserted
as the new mergepoint immediately before c8d9e0f1a2b3, creating the variant
tables and bringing cart_items/order_items/warehouse_stock into the shape the
current models expect (variant_id instead of product_id, where applicable).
It intentionally does NOT add product_variants.price_adjustment — c8d9e0f1a2b3
still owns that column and runs immediately after this one.

Revision ID: a0b1c2d3e4f5
Revises: b2c3d4e5f6a7, e3f4a5b6c7d8
Create Date: 2026-07-07
"""
from alembic import op
import sqlalchemy as sa


revision = 'a0b1c2d3e4f5'
down_revision = ('b2c3d4e5f6a7', 'e3f4a5b6c7d8')
branch_labels = None
depends_on = None


def upgrade():
    # --- new variant tables -------------------------------------------------
    op.create_table(
        'product_option_types',
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_product_option_types_product_id'), 'product_option_types', ['product_id'], unique=False
    )

    op.create_table(
        'product_variants',
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('sku', sa.String(length=100), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        # NOTE: price_adjustment is intentionally NOT created here — the very
        # next migration, c8d9e0f1a2b3, adds it via ALTER TABLE.
    )
    op.create_index(
        op.f('ix_product_variants_product_id'), 'product_variants', ['product_id'], unique=False
    )
    op.create_index(
        op.f('ix_product_variants_sku'), 'product_variants', ['sku'], unique=True
    )

    op.create_table(
        'product_option_values',
        sa.Column('option_type_id', sa.String(length=36), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['option_type_id'], ['product_option_types.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_product_option_values_option_type_id'),
        'product_option_values', ['option_type_id'], unique=False,
    )

    op.create_table(
        'product_variant_options',
        sa.Column('variant_id', sa.String(length=36), nullable=False),
        sa.Column('option_value_id', sa.String(length=36), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['option_value_id'], ['product_option_values.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('variant_id', 'option_value_id', name='uq_variant_option'),
    )
    op.create_index(
        op.f('ix_product_variant_options_variant_id'),
        'product_variant_options', ['variant_id'], unique=False,
    )

    # --- reshape cart_items: product_id -> variant_id -----------------------
    with op.batch_alter_table('cart_items') as batch_op:
        batch_op.add_column(sa.Column('variant_id', sa.String(length=36), nullable=False))
        batch_op.create_foreign_key(
            'fk_cart_items_variant_id_product_variants',
            'product_variants', ['variant_id'], ['id'], ondelete='CASCADE',
        )
        batch_op.drop_constraint('uq_cart_product', type_='unique')
        batch_op.create_unique_constraint('uq_cart_variant', ['cart_id', 'variant_id'])
        batch_op.drop_column('product_id')

    # --- order_items: add variant reference (product_id stays put) ----------
    with op.batch_alter_table('order_items') as batch_op:
        batch_op.add_column(sa.Column('variant_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('variant_label', sa.String(length=500), nullable=True))
        batch_op.create_foreign_key(
            'fk_order_items_variant_id_product_variants',
            'product_variants', ['variant_id'], ['id'], ondelete='SET NULL',
        )

    # --- reshape warehouse_stock: product_id -> variant_id -------------------
    with op.batch_alter_table('warehouse_stock') as batch_op:
        batch_op.add_column(sa.Column('variant_id', sa.String(length=36), nullable=False))
        batch_op.create_foreign_key(
            'fk_warehouse_stock_variant_id_product_variants',
            'product_variants', ['variant_id'], ['id'], ondelete='CASCADE',
        )
        batch_op.drop_index('ix_warehouse_stock_product_id')
        batch_op.create_index('ix_warehouse_stock_variant_id', ['variant_id'])
        batch_op.drop_constraint('uq_warehouse_product', type_='unique')
        batch_op.create_unique_constraint('uq_warehouse_variant', ['warehouse_id', 'variant_id'])
        batch_op.drop_column('product_id')


def downgrade():
    with op.batch_alter_table('warehouse_stock') as batch_op:
        batch_op.add_column(sa.Column('product_id', sa.String(length=36), nullable=False))
        batch_op.create_foreign_key(
            None, 'products', ['product_id'], ['id'], ondelete='CASCADE',
        )
        batch_op.drop_constraint('uq_warehouse_variant', type_='unique')
        batch_op.drop_index('ix_warehouse_stock_variant_id')
        batch_op.create_index('ix_warehouse_stock_product_id', ['product_id'])
        batch_op.create_unique_constraint('uq_warehouse_product', ['warehouse_id', 'product_id'])
        batch_op.drop_column('variant_id')

    with op.batch_alter_table('order_items') as batch_op:
        batch_op.drop_constraint('fk_order_items_variant_id_product_variants', type_='foreignkey')
        batch_op.drop_column('variant_label')
        batch_op.drop_column('variant_id')

    with op.batch_alter_table('cart_items') as batch_op:
        batch_op.add_column(sa.Column('product_id', sa.String(length=36), nullable=False))
        batch_op.create_foreign_key(
            None, 'products', ['product_id'], ['id'], ondelete='CASCADE',
        )
        batch_op.drop_constraint('uq_cart_variant', type_='unique')
        batch_op.create_unique_constraint('uq_cart_product', ['cart_id', 'product_id'])
        batch_op.drop_column('variant_id')

    op.drop_index(op.f('ix_product_variant_options_variant_id'), table_name='product_variant_options')
    op.drop_table('product_variant_options')
    op.drop_index(op.f('ix_product_option_values_option_type_id'), table_name='product_option_values')
    op.drop_table('product_option_values')
    op.drop_index(op.f('ix_product_variants_sku'), table_name='product_variants')
    op.drop_index(op.f('ix_product_variants_product_id'), table_name='product_variants')
    op.drop_table('product_variants')
    op.drop_index(op.f('ix_product_option_types_product_id'), table_name='product_option_types')
    op.drop_table('product_option_types')
