MANIFEST = {
    "name": "reviews",
    "label": "Reviews",
    "icon": "star",
    "admin_menu": [
        {"label": "Reviews", "path": "/admin/reviews"},
    ],
    "superadmin_menu": [],
    "required_permissions": [],
    "depends_on": ["auth", "products", "orders"],
}
