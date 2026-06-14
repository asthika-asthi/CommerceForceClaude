import uuid
import os
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Request, HTTPException, Depends
from app.core.dependencies import require_admin

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


@router.post("/upload", dependencies=[Depends(require_admin())])
async def upload_file(request: Request, file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Allowed: jpeg, png, gif, webp")
    contents = await file.read(MAX_BYTES + 1)
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    safe_name = Path(file.filename or "file").name
    filename = f"{uuid.uuid4()}-{safe_name}"
    filepath = UPLOAD_DIR / filename
    try:
        filepath.write_bytes(contents)
    except OSError:
        raise HTTPException(status_code=500, detail="Storage error")
    base_url = str(request.base_url).rstrip("/")
    return {"url": f"{base_url}/uploads/{filename}"}
