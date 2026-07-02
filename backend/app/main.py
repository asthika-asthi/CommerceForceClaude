from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.limiter import limiter
from app.core.plugin_registry import register_plugins, get_manifests
from app.shared.exceptions import AppException, app_exception_handler
from app.routers.media import router as media_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"\nCommerceForce — environment: {settings.ENVIRONMENT}")
    print(f"Plugins active: {settings.enabled_plugins}")
    print("Ready.\n")
    yield


app = FastAPI(
    title="CommerceForce API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppException, app_exception_handler)

# Serve uploaded files as static assets
# UPLOAD_DIR is created at module level in app.routers.media; guard here too for safety
from app.routers.media import UPLOAD_DIR as _UPLOAD_DIR
_UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_UPLOAD_DIR), html=False), name="uploads")

# System routers
app.include_router(media_router, prefix="/api/media", tags=["Media"])

# Register plugins at module load time so routes are in the routing table
# before any request (including test clients) is processed.
register_plugins(app)


@app.get("/api/health", tags=["System"])
async def health():
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "plugins": settings.enabled_plugins,
    }


@app.get("/api/menu", tags=["System"])
async def menu():
    """Returns nav items from all active plugins. Used by the admin shell to build navigation."""
    manifests = get_manifests()
    return {
        "admin_menu": [
            {"plugin": m["name"], "label": m["label"], "icon": m.get("icon"), "items": m["admin_menu"]}
            for m in manifests
        ],
        "superadmin_menu": [
            {"plugin": m["name"], "label": m["label"], "icon": m.get("icon"), "items": m["superadmin_menu"]}
            for m in manifests
            if m.get("superadmin_menu")
        ],
    }
