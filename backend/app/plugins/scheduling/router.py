from fastapi import APIRouter

from app.plugins.scheduling import templates

router = APIRouter()


@router.get("/config")
async def get_config():
    return templates.get_active_config()
