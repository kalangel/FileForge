# FileForge

Веб-конвертер файлов и PDF-редактор. Изображения, документы, таблицы, аудио/видео и PDF
обрабатываются прямо в браузере (Canvas, pdf.js/pdf-lib, ffmpeg.wasm, SheetJS, mammoth); backend
на FastAPI подключается только для форматов, которые браузер не тянет (ODT/RTF, TIFF/ICO, пароли PDF).

Стек: React + Vite + Tailwind (frontend), FastAPI + Pillow/pypdf + LibreOffice (backend, опционально).

## Запуск

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Backend (нужен только для ODT/RTF и TIFF/ICO):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
