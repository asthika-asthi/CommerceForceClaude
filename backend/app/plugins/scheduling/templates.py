"""Scheduling plugin — terminology + note-template registry.

The scheduling engine itself is domain-neutral (client/provider/appointment/journal),
but ships configured for a medical deployment by default (patient/doctor/visit/clinical
note, SOAP notes). All labels and form schemas below are what both the storefront and
admin frontends read via GET /api/scheduling/config.
"""
from app.core.config import settings

# Neutral concept -> deployment-specific label. This is the active (medical) deployment.
TERMS = {
    "client_singular": "Patient",
    "client_plural": "Patients",
    "provider_singular": "Doctor",
    "provider_plural": "Doctors",
    "appointment_singular": "Visit",
    "appointment_plural": "Visits",
    "journal_singular": "Clinical Note",
    "journal_plural": "Clinical Notes",
}

# Available note templates, keyed by name.
NOTE_TEMPLATES = {
    "soap": {
        "name": "soap",
        "label": "SOAP Note",
        "fields": [
            {"key": "subjective", "label": "Subjective", "type": "textarea"},
            {"key": "objective", "label": "Objective", "type": "textarea"},
            {"key": "assessment", "label": "Assessment", "type": "textarea"},
            {"key": "plan", "label": "Plan", "type": "textarea"},
        ],
    },
    "visit_note": {
        "name": "visit_note",
        "label": "Visit Note",
        "fields": [
            {"key": "notes", "label": "Notes", "type": "textarea"},
        ],
    },
}

# Medical intake form schema.
INTAKE_SCHEMA = [
    {"key": "allergies", "label": "Allergies", "type": "textarea"},
    {"key": "current_medications", "label": "Current Medications", "type": "textarea"},
    {"key": "insurance_provider", "label": "Insurance Provider", "type": "text"},
    {"key": "insurance_number", "label": "Insurance Number", "type": "text"},
    {"key": "emergency_contact", "label": "Emergency Contact", "type": "text"},
]


def list_note_template_names() -> list[str]:
    """Names of the available note templates (used later by journal validation)."""
    return list(NOTE_TEMPLATES.keys())


def get_active_note_template() -> dict:
    """Return the note template configured for this deployment, falling back to SOAP
    if the configured name is unknown."""
    name = settings.SCHEDULING_NOTE_TEMPLATE
    return NOTE_TEMPLATES.get(name, NOTE_TEMPLATES["soap"])


def get_active_config() -> dict:
    return {
        "terms": TERMS,
        "note_template": get_active_note_template(),
        "intake_schema": INTAKE_SCHEMA,
    }
