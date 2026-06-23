"""FileForge backend.

Handles only the conversions that cannot run in the browser:
  * Image formats Canvas can't decode/encode (TIFF, ICO, optimised GIF, AVIF) — Pillow
  * Office documents (ODT, RTF, DOC -> X) — LibreOffice (headless)
  * PDF password protect / unlock — pypdf

Everything else is done client-side by the React app for privacy.
Run with:  uvicorn main:app --reload --port 8000
"""

import io
import os
import shutil
import subprocess
import tempfile
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="FileForge API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Format helpers ---------------------------------------------------------

MIME = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "tiff": "image/tiff",
    "ico": "image/x-icon",
    "avif": "image/avif",
    "pdf": "application/pdf",
    "txt": "text/plain",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "odt": "application/vnd.oasis.opendocument.text",
    "rtf": "application/rtf",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv",
    "ods": "application/vnd.oasis.opendocument.spreadsheet",
}

IMAGE_EXTS = {"png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "ico", "avif"}
OFFICE_EXTS = {"docx", "odt", "rtf", "doc", "xlsx", "ods", "csv", "pdf"}


def _stream(data: bytes, target: str, name: str) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(data),
        media_type=MIME.get(target, "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{name}.{target}"'},
    )


# ---- Image conversion (Pillow) ---------------------------------------------

def convert_image(data: bytes, target: str) -> bytes:
    from PIL import Image

    img = Image.open(io.BytesIO(data))
    out = io.BytesIO()

    pil_format = {
        "jpg": "JPEG",
        "jpeg": "JPEG",
        "png": "PNG",
        "webp": "WEBP",
        "gif": "GIF",
        "bmp": "BMP",
        "tiff": "TIFF",
        "ico": "ICO",
        "avif": "AVIF",
    }.get(target)

    if pil_format is None:
        raise HTTPException(400, f"Целевой формат {target} не поддерживается")

    # Flatten alpha for formats without transparency.
    if pil_format in ("JPEG", "BMP") and img.mode in ("RGBA", "P", "LA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[-1])
        img = bg
    elif img.mode == "P" and pil_format != "GIF":
        img = img.convert("RGBA")

    save_kwargs = {}
    if pil_format == "JPEG":
        save_kwargs = {"quality": 90, "optimize": True}
    elif pil_format == "ICO":
        save_kwargs = {"sizes": [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]}

    img.save(out, format=pil_format, **save_kwargs)
    return out.getvalue()


# ---- Office conversion (LibreOffice headless) ------------------------------

def libreoffice_available() -> bool:
    return shutil.which("libreoffice") is not None or shutil.which("soffice") is not None


def convert_office(data: bytes, source: str, target: str) -> bytes:
    binary = shutil.which("libreoffice") or shutil.which("soffice")
    if not binary:
        raise HTTPException(503, "LibreOffice не установлен на сервере")

    with tempfile.TemporaryDirectory() as tmp:
        src_path = os.path.join(tmp, f"input.{source}")
        with open(src_path, "wb") as f:
            f.write(data)

        proc = subprocess.run(
            [binary, "--headless", "--convert-to", target, "--outdir", tmp, src_path],
            capture_output=True,
            timeout=120,
        )
        out_path = os.path.join(tmp, f"input.{target}")
        if not os.path.exists(out_path):
            raise HTTPException(
                500,
                f"LibreOffice не смог конвертировать: {proc.stderr.decode(errors='ignore')[:300]}",
            )
        with open(out_path, "rb") as f:
            return f.read()


# ---- Routes -----------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "libreoffice": libreoffice_available()}


@app.post("/api/convert")
async def convert(
    file: UploadFile = File(...),
    target: str = Form(...),
    source: Optional[str] = Form(None),
):
    target = target.lower().lstrip(".")
    src_ext = (source or (file.filename or "").rsplit(".", 1)[-1]).lower()
    data = await file.read()
    if not data:
        raise HTTPException(400, "Пустой файл")

    stem = (file.filename or "output").rsplit(".", 1)[0]

    try:
        if src_ext in IMAGE_EXTS and target in IMAGE_EXTS:
            result = convert_image(data, target)
        elif src_ext in OFFICE_EXTS or target in OFFICE_EXTS:
            result = convert_office(data, src_ext, target)
        else:
            raise HTTPException(400, f"Конвертация {src_ext} → {target} не поддерживается")
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Ошибка конвертации: {e}")

    return _stream(result, target, stem)


@app.post("/api/pdf/password")
async def pdf_password(
    file: UploadFile = File(...),
    action: str = Form(...),  # "protect" | "unlock"
    password: str = Form(""),
    new_password: Optional[str] = Form(None),
):
    from pypdf import PdfReader, PdfWriter

    data = await file.read()
    stem = (file.filename or "document").rsplit(".", 1)[0]

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            if reader.decrypt(password) == 0:
                raise HTTPException(401, "Неверный пароль")

        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)

        if action == "protect":
            writer.encrypt(new_password or password)
        elif action != "unlock":
            raise HTTPException(400, "action должен быть 'protect' или 'unlock'")

        out = io.BytesIO()
        writer.write(out)
        return _stream(out.getvalue(), "pdf", stem)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Ошибка обработки PDF: {e}")
