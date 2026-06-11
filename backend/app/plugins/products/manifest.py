MANIFEST = {
    "name": "products",
    "label": "Products",
    "icon": "package",
    "admin_menu": [
        {"label": "All Products", "path": "/admin/products", "icon": "package"},
        {"label": "Add Product", "path": "/admin/products/new", "icon": "plus"},
    ],
    "superadmin_menu": [],
    "required_permissions": [],
    "depends_on": ["categories"],
}
