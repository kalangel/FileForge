// Client-side image conversion using the Canvas API.
// Nothing leaves the browser here.

import { getMime, normalizeExt } from './formats.js'

/** Load any browser-decodable image (incl. SVG) into an HTMLImageElement. */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Не удалось декодировать изображение в браузере'))
    }
    img.src = url
  })
}

/**
 * Compute target dimensions honouring an optional aspect-ratio lock.
 * opts: { width, height, keepRatio, maxPreset }
 */
export function computeDimensions(natW, natH, opts = {}) {
  let { width, height, keepRatio = true } = opts
  width = width ? Math.round(width) : null
  height = height ? Math.round(height) : null

  if (!width && !height) return { width: natW, height: natH }
  if (keepRatio) {
    const ratio = natW / natH
    if (width && !height) height = Math.round(width / ratio)
    else if (height && !width) width = Math.round(height * ratio)
    else {
      // Both provided: fit within the box while preserving ratio.
      const scale = Math.min(width / natW, height / natH)
      width = Math.round(natW * scale)
      height = Math.round(natH * scale)
    }
  } else {
    width = width || natW
    height = height || natH
  }
  return { width: Math.max(1, width), height: Math.max(1, height) }
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`Браузер не умеет кодировать ${mime}`))),
      mime,
      quality,
    )
  })
}

/**
 * Convert a single image file.
 * options: { to, width, height, keepRatio, quality(0..1) }
 * Returns a Blob.
 */
export async function convertImage(file, options) {
  const to = normalizeExt(options.to)
  const img = await loadImage(file)
  const natW = img.naturalWidth || img.width
  const natH = img.naturalHeight || img.height
  const { width, height } = computeDimensions(natW, natH, options)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // JPEG/BMP have no alpha; paint a white background to avoid black fills.
  if (to === 'jpg' || to === 'bmp') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)

  if (to === 'ico') return encodeIco(canvas)
  if (to === 'pdf') return imageCanvasToPdf(canvas)

  const mime = getMime(to)
  const quality = typeof options.quality === 'number' ? options.quality : 0.92
  return canvasToBlob(canvas, mime, quality)
}

/** Build a (single-image, PNG-based) .ico from a canvas. */
async function encodeIco(srcCanvas) {
  // ICO entries are capped at 256px per side.
  const sizes = [256, 128, 64, 48, 32, 16].filter(
    (s) => s <= Math.max(srcCanvas.width, srcCanvas.height) || s <= 256,
  )
  const pngs = []
  for (const size of sizes.length ? sizes : [256]) {
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(srcCanvas, 0, 0, size, size)
    const blob = await canvasToBlob(c, 'image/png', 1)
    pngs.push({ size, data: new Uint8Array(await blob.arrayBuffer()) })
  }

  const count = pngs.length
  const header = 6 + count * 16
  let offset = header
  const total = header + pngs.reduce((s, p) => s + p.data.length, 0)
  const buf = new ArrayBuffer(total)
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)

  view.setUint16(0, 0, true) // reserved
  view.setUint16(2, 1, true) // type: icon
  view.setUint16(4, count, true)

  pngs.forEach((p, i) => {
    const e = 6 + i * 16
    view.setUint8(e, p.size >= 256 ? 0 : p.size) // width (0 = 256)
    view.setUint8(e + 1, p.size >= 256 ? 0 : p.size) // height
    view.setUint8(e + 2, 0) // palette
    view.setUint8(e + 3, 0) // reserved
    view.setUint16(e + 4, 1, true) // color planes
    view.setUint16(e + 6, 32, true) // bpp
    view.setUint32(e + 8, p.data.length, true) // size
    view.setUint32(e + 12, offset, true) // offset
    bytes.set(p.data, offset)
    offset += p.data.length
  })

  return new Blob([buf], { type: 'image/x-icon' })
}

/** Wrap a rasterised image canvas into a one-page PDF using pdf-lib. */
async function imageCanvasToPdf(canvas) {
  const { PDFDocument } = await import('pdf-lib')
  const pngBlob = await canvasToBlob(canvas, 'image/png', 1)
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer())
  const doc = await PDFDocument.create()
  const png = await doc.embedPng(pngBytes)
  const page = doc.addPage([png.width, png.height])
  page.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height })
  const out = await doc.save()
  return new Blob([out], { type: 'application/pdf' })
}

export const RESOLUTION_PRESETS = [
  { label: 'Оригинал', width: null, height: null },
  { label: 'Иконка 256×256', width: 256, height: 256 },
  { label: 'HD 1280×720', width: 1280, height: 720 },
  { label: 'Full HD 1920×1080', width: 1920, height: 1080 },
  { label: '2K 2560×1440', width: 2560, height: 1440 },
  { label: '4K 3840×2160', width: 3840, height: 2160 },
  { label: 'Web small 800×600', width: 800, height: 600 },
]
