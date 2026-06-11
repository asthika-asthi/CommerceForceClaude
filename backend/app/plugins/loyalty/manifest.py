MANIFEST = {
    "name": "loyalty",
    "label": "Loyalty",
    "icon": "star",
    "admin_menu": [
        {"label": "Loyalty Config", "path": "/admin/loyalty/config"},
        {"label": "Points Adjust", "path": "/admin/loyalty/adjust"},
    ],
    "superadmin_menu": [],
    "required_permissions": ["loyalty:read"],
    "depends_on": [],
}
