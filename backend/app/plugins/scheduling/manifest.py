MANIFEST = {
    "name": "scheduling",
    "label": "Scheduling",
    "icon": "calendar",
    "admin_menu": [
        {"label": "Calendar", "path": "/admin/scheduling", "icon": "calendar"},
        {"label": "Appointments", "path": "/admin/scheduling/appointments", "icon": "calendar"},
        {"label": "Clients", "path": "/admin/scheduling/clients", "icon": "users"},
        {"label": "Providers", "path": "/admin/scheduling/providers", "icon": "user"},
        {"label": "Appointment Types", "path": "/admin/scheduling/types", "icon": "list"},
        {"label": "Availability", "path": "/admin/scheduling/availability", "icon": "clock"},
    ],
    "superadmin_menu": [],
    "required_permissions": [],
    "depends_on": ["auth"],
}
