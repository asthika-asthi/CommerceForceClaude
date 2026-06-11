MANIFEST = {
    "name": "inventory",
    "label": "Inventory",
    "icon": "warehouse",
    "admin_menu": [
        {"label": "Warehouses", "path": "/admin/inventory/warehouses"},
        {"label": "Stock Levels", "path": "/admin/inventory/stock"},
    ],
    "superadmin_menu": [],
    "required_permissions": ["inventory:read"],
    "depends_on": ["products"],
}
