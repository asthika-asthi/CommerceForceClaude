MANIFEST = {
    "name": "newsletter",
    "label": "Newsletter",
    "icon": "mail",
    "admin_menu": [
        {"label": "Subscribers", "path": "/admin/newsletter/subscribers"},
    ],
    "superadmin_menu": [],
    "required_permissions": ["newsletter:read"],
    "depends_on": [],
}
