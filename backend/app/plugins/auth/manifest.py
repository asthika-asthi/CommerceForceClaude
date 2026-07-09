MANIFEST = {
    "name": "auth",
    "label": "Authentication",
    "icon": "lock",
    "admin_menu": [
        {"label": "Users", "path": "/admin/users", "icon": "users"},
        {"label": "Data Requests", "path": "/admin/deletion-requests", "icon": "shield"},
    ],
    "superadmin_menu": [
        {"label": "All Users", "path": "/superadmin/users", "icon": "users"},
        {"label": "Roles & Permissions", "path": "/superadmin/roles", "icon": "shield"},
    ],
    "required_permissions": [],
    "depends_on": [],
}
