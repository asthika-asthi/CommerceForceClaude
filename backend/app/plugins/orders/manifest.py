MANIFEST = {
    "name": "orders",
    "label": "Orders",
    "icon": "clipboard-list",
    "admin_menu": [
        {"label": "All Orders", "path": "/admin/orders", "icon": "clipboard-list"},
        {"label": "Order Status", "path": "/admin/orders/status", "icon": "refresh"},
    ],
    "superadmin_menu": [],
    "required_permissions": [],
    "depends_on": ["products"],
}
