MANIFEST = {
    "name": "inventory",
    "label": "Inventory",
    "icon": "warehouse",
    "admin_menu": [
        {"label": "Inventory", "path": "/admin/inventory"},
    ],
    "superadmin_menu": [],
    "required_permissions": ["inventory:read"],
    "depends_on": ["products"],
}
