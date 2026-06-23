// Central registry of supported formats and the valid conversion pairs.
//
// Each conversion declares an `engine`, which tells the UI which client-side
// module will run it (or `server` when it must fall back to the backend):
//   canvas  -> imageConverter.js   (Canvas API)
//   pdf     -> pdfTools.js         (pdf-lib / pdf.js)
//   doc     -> docConverter.js     (mammoth / marked / turndown / jsPDF)
//   sheet   -> docConverter.js     (SheetJS / xlsx)
//   ffmpeg  -> mediaConverter.js   (ffmpeg.wasm)
//   server  -> backend FastAPI     (Pillow / ffmpeg / libreoffice / pypdf)

export const CATEGORIES = {
  image: 'Изображения',
  document: 'Документы',
  spreadsheet: 'Таблицы',
  audio: 'Аудио',
  video: 'Видео',
}

// format -> metadata
export const FORMATS = {
  // Images
  png: { category: 'image', mime: 'image/png' },
  jpg: { category: 'image', mime: 'image/jpeg', aliases: ['jpeg'] },
  webp: { category: 'image', mime: 'image/webp' },
  gif: { category: 'image', mime: 'image/gif' },
  bmp: { category: 'image', mime: 'image/bmp' },
  tiff: { category: 'image', mime: 'image/tiff', aliases: ['tif'] },
  svg: { category: 'image', mime: 'image/svg+xml' },
  ico: { category: 'image', mime: 'image/x-icon' },
  avif: { category: 'image', mime: 'image/avif' },
  // Documents
  pdf: { category: 'document', mime: 'application/pdf' },
  docx: {
    category: 'document',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  txt: { category: 'document', mime: 'text/plain' },
  md: { category: 'document', mime: 'text/markdown' },
  html: { category: 'document', mime: 'text/html', aliases: ['htm'] },
  rtf: { category: 'document', mime: 'application/rtf' },
  odt: { category: 'document', mime: 'application/vnd.oasis.opendocument.text' },
  // Spreadsheets
  xlsx: {
    category: 'spreadsheet',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  csv: { category: 'spreadsheet', mime: 'text/csv' },
  ods: { category: 'spreadsheet', mime: 'application/vnd.oasis.opendocument.spreadsheet' },
  // Audio
  mp3: { category: 'audio', mime: 'audio/mpeg' },
  wav: { category: 'audio', mime: 'audio/wav' },
  ogg: { category: 'audio', mime: 'audio/ogg' },
  flac: { category: 'audio', mime: 'audio/flac' },
  m4a: { category: 'audio', mime: 'audio/mp4' },
  // Video
  mp4: { category: 'video', mime: 'video/mp4' },
  webm: { category: 'video', mime: 'video/webm' },
  mov: { category: 'video', mime: 'video/quicktime' },
  avi: { category: 'video', mime: 'video/x-msvideo' },
}

// Raster image formats the browser Canvas can both decode and encode.
const RASTER_CANVAS = ['png', 'jpg', 'webp', 'bmp']

// Build the per-format conversion table.
function buildConversions() {
  const c = {}
  const add = (from, to, engine) => {
    if (!c[from]) c[from] = []
    if (from !== to) c[from].push({ to, engine })
  }

  // ---- Images ----
  // Sources decodable by the Canvas API (incl. avif/gif first frame in modern browsers).
  const canvasDecodable = ['png', 'jpg', 'webp', 'bmp', 'gif', 'avif', 'svg']
  for (const from of canvasDecodable) {
    for (const to of RASTER_CANVAS) add(from, to, 'canvas')
    add(from, 'avif', 'canvas') // encode attempt; falls back to server on failure
    add(from, 'ico', 'canvas') // custom multi-size ICO encoder
    add(from, 'pdf', 'canvas') // wrap image into a PDF page
    add(from, 'gif', 'server') // animated/optimised GIF -> backend
    add(from, 'tiff', 'server')
  }
  // Sources the browser cannot reliably decode -> backend.
  for (const from of ['tiff', 'ico']) {
    for (const to of [...RASTER_CANVAS, 'gif', 'tiff', 'pdf']) add(from, to, 'server')
  }

  // ---- Documents ----
  add('md', 'html', 'doc')
  add('md', 'txt', 'doc')
  add('md', 'pdf', 'doc')
  add('html', 'md', 'doc')
  add('html', 'txt', 'doc')
  add('html', 'pdf', 'doc')
  add('txt', 'md', 'doc')
  add('txt', 'html', 'doc')
  add('txt', 'pdf', 'doc')
  add('docx', 'html', 'doc')
  add('docx', 'txt', 'doc')
  add('docx', 'md', 'doc')
  add('docx', 'pdf', 'doc')
  add('pdf', 'txt', 'pdf')
  // Round-trips that need a real office engine.
  add('docx', 'odt', 'server')
  add('docx', 'rtf', 'server')
  add('odt', 'docx', 'server')
  add('odt', 'pdf', 'server')
  add('odt', 'txt', 'server')
  add('rtf', 'docx', 'server')
  add('rtf', 'pdf', 'server')
  add('rtf', 'txt', 'server')
  add('pdf', 'docx', 'server')

  // ---- Spreadsheets ----
  add('xlsx', 'csv', 'sheet')
  add('xlsx', 'html', 'sheet')
  add('csv', 'xlsx', 'sheet')
  add('csv', 'html', 'sheet')
  add('ods', 'csv', 'sheet')
  add('ods', 'xlsx', 'sheet')
  add('xlsx', 'ods', 'server')
  add('csv', 'ods', 'server')

  // ---- Audio (ffmpeg.wasm) ----
  const audio = ['mp3', 'wav', 'ogg', 'flac', 'm4a']
  for (const from of audio) for (const to of audio) add(from, to, 'ffmpeg')

  // ---- Video (ffmpeg.wasm) ----
  const video = ['mp4', 'webm', 'mov', 'avi']
  for (const from of video) {
    for (const to of video) add(from, to, 'ffmpeg')
    add(from, 'gif', 'ffmpeg')
    add(from, 'mp3', 'ffmpeg') // extract audio
    add(from, 'wav', 'ffmpeg')
  }

  return c
}

export const CONVERSIONS = buildConversions()

/** Normalise an extension, resolving aliases (jpeg->jpg, htm->html, ...). */
export function normalizeExt(ext) {
  const e = (ext || '').toLowerCase()
  if (FORMATS[e]) return e
  for (const [key, meta] of Object.entries(FORMATS)) {
    if (meta.aliases?.includes(e)) return key
  }
  return e
}

export function getCategory(ext) {
  return FORMATS[normalizeExt(ext)]?.category || null
}

export function getMime(ext) {
  return FORMATS[normalizeExt(ext)]?.mime || 'application/octet-stream'
}

/** Valid conversion targets for a given source extension. */
export function getTargets(ext) {
  return CONVERSIONS[normalizeExt(ext)] || []
}

export function isSupported(ext) {
  return Boolean(FORMATS[normalizeExt(ext)])
}
