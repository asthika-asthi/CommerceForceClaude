MANIFEST = {
    "name": "rfq",
    "label": "RFQ",
    "icon": "file-text",
    "admin_menu": [
        {"label": "All RFQs", "path": "/admin/rfq"},
        {"label": "Pending Review", "path": "/admin/rfq?status=submitted"},
    ],
    "superadmin_menu": [],
    "required_permissions": ["rfq:read"],
    "depends_on": ["orders"],
}
