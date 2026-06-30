import re
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Request, HTTPException, Depends, Query
from app.core.dependencies import require_admin

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_FOLDER_RE = re.compile(r'^[a-zA-Z0-9_-]+$')


@router.get("/files", dependencies=[Depends(require_admin())])
async def list_files(request: Request):
    base_url = str(request.base_url).rstrip("/")
    files = []
    for f in sorted(UPLOAD_DIR.rglob("*"), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file():
            stat = f.stat()
            rel = f.relative_to(UPLOAD_DIR)
            files.append({
                "filename": rel.as_posix(),
                "url": f"{base_url}/uploads/{rel.as_posix()}",
                "size": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
    return files


@router.delete("/files/{filepath:path}", dependencies=[Depends(require_admin())])
async def delete_file(filepath: str):
    if ".." in Path(filepath).parts:
        raise HTTPException(status_code=400, detail="Invalid path")
    full_path = (UPLOAD_DIR / filepath).resolve()
    if not full_path.is_relative_to(UPLOAD_DIR.resolve()):
        raise HTTPException(status_code=400, detail="Invalid path")
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    full_path.unlink()
    return {"deleted": filepath}


@router.post("/upload", dependencies=[Depends(require_admin())])
async def upload_file(request: Request, file: UploadFile = File(...), folder: str = Query("")):
    if folder and not _FOLDER_RE.match(folder):
        raise HTTPException(status_code=400, detail="Invalid folder name")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Allowed: jpeg, png, gif, webp")
    contents = await file.read(MAX_BYTES + 1)
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    safe_name = Path(file.filename or "file").name
    save_dir = UPLOAD_DIR / folder if folder else UPLOAD_DIR
    save_dir.mkdir(parents=True, exist_ok=True)
    filepath = save_dir / safe_name
    try:
        filepath.write_bytes(contents)
    except OSError:
        raise HTTPException(status_code=500, detail="Storage error")
    base_url = str(request.base_url).rstrip("/")
    url = f"{base_url}/uploads/{folder}/{safe_name}" if folder else f"{base_url}/uploads/{safe_name}"
    return {"url": url}
