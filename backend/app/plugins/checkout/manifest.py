MANIFEST = {
    "name": "checkout",
    "label": "Checkout",
    "icon": "credit-card",
    "admin_menu": [],
    "superadmin_menu": [
        {"label": "Payment Methods", "path": "/superadmin/checkout/payment-methods", "icon": "credit-card"},
    ],
    "required_permissions": [],
    "depends_on": ["cart", "orders"],
}
