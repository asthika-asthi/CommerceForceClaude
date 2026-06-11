MANIFEST = {
    "name": "rfq",
    "label": "RFQ",
    "icon": "file-text",
    "admin_menu": [
        {"label": "All RFQs", "path": "/admin/rfqs"},
        {"label": "Pending Review", "path": "/admin/rfqs?status=submitted"},
    ],
    "superadmin_menu": [],
    "required_permissions": ["rfq:read"],
    "depends_on": ["orders"],
}
