MANIFEST = {
    "name": "coupons",
    "label": "Coupons",
    "icon": "tag",
    "admin_menu": [
        {"label": "All Coupons", "path": "/admin/coupons"},
        {"label": "Create Coupon", "path": "/admin/coupons/new"},
    ],
    "superadmin_menu": [],
    "required_permissions": ["coupons:read"],
    "depends_on": [],
}
