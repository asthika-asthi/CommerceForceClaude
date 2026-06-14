import uuid
import os
from fastapi import APIRouter, UploadFile, File, Request

router = APIRouter()

UPLOAD_DIR = "uploads"


@router.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    filename = f"{uuid.uuid4()}-{file.filename or 'file'}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)
    base_url = str(request.base_url).rstrip("/")
    return {"url": f"{base_url}/uploads/{filename}"}
