"""add scheduling plugin tables

Revision ID: 62d9c03455e5
Revises: f2a3b4c5d6e7
Create Date: 2026-07-06
"""
from alembic import op
import sqlalchemy as sa

revision = '62d9c03455e5'
down_revision = 'f2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'scheduling_providers',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('display_name', sa.String(255), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('specialty', sa.String(255), nullable=True),
        sa.Column('bio', sa.Text, nullable=True),
        sa.Column('color', sa.String(50), nullable=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('can_view_all_clients', sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_scheduling_providers_user_id', 'scheduling_providers', ['user_id'])

    op.create_table(
        'scheduling_appointment_types',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('duration_minutes', sa.Integer, nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('price', sa.Numeric(12, 2), nullable=True),
        sa.Column('color', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        'scheduling_provider_types',
        sa.Column('provider_id', sa.String(36), sa.ForeignKey('scheduling_providers.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('appointment_type_id', sa.String(36), sa.ForeignKey('scheduling_appointment_types.id', ondelete='CASCADE'), primary_key=True),
    )

    op.create_table(
        'scheduling_availability',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('provider_id', sa.String(36), sa.ForeignKey('scheduling_providers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('weekday', sa.Integer, nullable=False),
        sa.Column('start_time', sa.Time, nullable=False),
        sa.Column('end_time', sa.Time, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_scheduling_availability_provider_id', 'scheduling_availability', ['provider_id'])

    op.create_table(
        'scheduling_availability_exceptions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('provider_id', sa.String(36), sa.ForeignKey('scheduling_providers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.Date, nullable=False),
        sa.Column('is_available', sa.Boolean, nullable=False),
        sa.Column('start_time', sa.Time, nullable=True),
        sa.Column('end_time', sa.Time, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        'ix_scheduling_availability_exceptions_provider_id',
        'scheduling_availability_exceptions', ['provider_id'],
    )

    op.create_table(
        'scheduling_clients',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('first_name', sa.String(255), nullable=False),
        sa.Column('last_name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('date_of_birth', sa.Date, nullable=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('custom_fields', sa.JSON, nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_scheduling_clients_email', 'scheduling_clients', ['email'])
    op.create_index('ix_scheduling_clients_user_id', 'scheduling_clients', ['user_id'])

    op.create_table(
        'scheduling_appointments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('provider_id', sa.String(36), sa.ForeignKey('scheduling_providers.id'), nullable=False),
        sa.Column('client_id', sa.String(36), sa.ForeignKey('scheduling_clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('appointment_type_id', sa.String(36), sa.ForeignKey('scheduling_appointment_types.id'), nullable=False),
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            'status',
            sa.Enum('requested', 'confirmed', 'completed', 'cancelled', 'no_show', name='appointmentstatus'),
            nullable=False,
            server_default='requested',
        ),
        sa.Column('reason', sa.Text, nullable=True),
        sa.Column('booked_by', sa.String(255), nullable=True),
        sa.Column('cancellation_reason', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_scheduling_appointments_provider_id', 'scheduling_appointments', ['provider_id'])
    op.create_index('ix_scheduling_appointments_client_id', 'scheduling_appointments', ['client_id'])
    op.create_index('ix_scheduling_appointments_appointment_type_id', 'scheduling_appointments', ['appointment_type_id'])
    # Task 10: DB-enforced guard against double-booking under concurrent sessions —
    # see the comment on Appointment.__table_args__ in models.py. PARTIAL (excludes
    # cancelled rows) so a cancelled appointment's slot can be re-booked.
    op.create_index(
        'uq_scheduling_appt_provider_start_active',
        'scheduling_appointments',
        ['provider_id', 'start_at'],
        unique=True,
        sqlite_where=sa.text("status != 'cancelled'"),
        postgresql_where=sa.text("status != 'cancelled'"),
    )

    op.create_table(
        'scheduling_journal_entries',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('client_id', sa.String(36), sa.ForeignKey('scheduling_clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider_id', sa.String(36), sa.ForeignKey('scheduling_providers.id'), nullable=False),
        sa.Column('appointment_id', sa.String(36), sa.ForeignKey('scheduling_appointments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('template', sa.String(100), nullable=False),
        sa.Column('content', sa.JSON, nullable=False),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_scheduling_journal_entries_client_id', 'scheduling_journal_entries', ['client_id'])
    op.create_index('ix_scheduling_journal_entries_provider_id', 'scheduling_journal_entries', ['provider_id'])
    op.create_index('ix_scheduling_journal_entries_appointment_id', 'scheduling_journal_entries', ['appointment_id'])
    op.create_index('ix_scheduling_journal_entries_created_by', 'scheduling_journal_entries', ['created_by'])

    op.create_table(
        'scheduling_note_access_log',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('journal_entry_id', sa.String(36), sa.ForeignKey('scheduling_journal_entries.id', ondelete='SET NULL'), nullable=True),
        sa.Column('client_id', sa.String(36), sa.ForeignKey('scheduling_clients.id', ondelete='CASCADE'), nullable=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_scheduling_note_access_log_journal_entry_id', 'scheduling_note_access_log', ['journal_entry_id'])
    op.create_index('ix_scheduling_note_access_log_client_id', 'scheduling_note_access_log', ['client_id'])
    op.create_index('ix_scheduling_note_access_log_user_id', 'scheduling_note_access_log', ['user_id'])


def downgrade():
    op.drop_index('ix_scheduling_note_access_log_user_id', table_name='scheduling_note_access_log')
    op.drop_index('ix_scheduling_note_access_log_client_id', table_name='scheduling_note_access_log')
    op.drop_index('ix_scheduling_note_access_log_journal_entry_id', table_name='scheduling_note_access_log')
    op.drop_table('scheduling_note_access_log')

    op.drop_index('ix_scheduling_journal_entries_created_by', table_name='scheduling_journal_entries')
    op.drop_index('ix_scheduling_journal_entries_appointment_id', table_name='scheduling_journal_entries')
    op.drop_index('ix_scheduling_journal_entries_provider_id', table_name='scheduling_journal_entries')
    op.drop_index('ix_scheduling_journal_entries_client_id', table_name='scheduling_journal_entries')
    op.drop_table('scheduling_journal_entries')

    op.drop_index('uq_scheduling_appt_provider_start_active', table_name='scheduling_appointments')
    op.drop_index('ix_scheduling_appointments_appointment_type_id', table_name='scheduling_appointments')
    op.drop_index('ix_scheduling_appointments_client_id', table_name='scheduling_appointments')
    op.drop_index('ix_scheduling_appointments_provider_id', table_name='scheduling_appointments')
    op.drop_table('scheduling_appointments')
    # Drop the enum type implicitly created with scheduling_appointments (Postgres);
    # no-op on SQLite. Prevents DuplicateObject on a subsequent upgrade.
    sa.Enum(name='appointmentstatus').drop(op.get_bind(), checkfirst=True)

    op.drop_index('ix_scheduling_clients_user_id', table_name='scheduling_clients')
    op.drop_index('ix_scheduling_clients_email', table_name='scheduling_clients')
    op.drop_table('scheduling_clients')

    op.drop_index('ix_scheduling_availability_exceptions_provider_id', table_name='scheduling_availability_exceptions')
    op.drop_table('scheduling_availability_exceptions')

    op.drop_index('ix_scheduling_availability_provider_id', table_name='scheduling_availability')
    op.drop_table('scheduling_availability')

    op.drop_table('scheduling_provider_types')

    op.drop_table('scheduling_appointment_types')

    op.drop_index('ix_scheduling_providers_user_id', table_name='scheduling_providers')
    op.drop_table('scheduling_providers')
