// Client-side image conversion using the Canvas API (+ UTIF for TIFF and
// gifenc for GIF). Nothing leaves the browser here.

import { getMime, normalizeExt } from './formats.js'
import { getExtension } from './utils.js'

/** Decode any supported image file into a full-resolution canvas. */
async function decodeToCanvas(file, ext) {
  if (ext === 'tiff') return decodeTiff(file)
  // Everything else (png/jpg/webp/bmp/gif/avif/svg/ico) is browser-decodable.
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  if (!canvas.width || !canvas.height) throw new Error('Пустое изображение')
  canvas.getContext('2d').drawImage(img, 0, 0)
  return canvas
}

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

async function decodeTiff(file) {
  const mod = await import('utif')
  const UTIF = mod.default ?? mod
  const buf = await file.arrayBuffer()
  const ifds = UTIF.decode(buf)
  if (!ifds.length) throw new Error('Не удалось декодировать TIFF')
  UTIF.decodeImage(buf, ifds[0])
  const rgba = UTIF.toRGBA8(ifds[0])
  const w = ifds[0].width
  const h = ifds[0].height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0)
  return canvas
}

/**
 * Compute target dimensions honouring an optional aspect-ratio lock.
 * opts: { width, height, keepRatio }
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
 * Convert a single image file. Returns a Blob.
 * options: { to, from?, width, height, keepRatio, quality(0..1) }
 */
export async function convertImage(file, options) {
  const to = normalizeExt(options.to)
  const from = normalizeExt(options.from || getExtension(file.name))
  const src = await decodeToCanvas(file, from)
  const { width, height } = computeDimensions(src.width, src.height, options)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  // JPEG/BMP/TIFF have no alpha here; paint white to avoid black fills.
  if (to === 'jpg' || to === 'bmp') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, width, height)

  const quality = typeof options.quality === 'number' ? options.quality : 0.92
  switch (to) {
    case 'ico':
      return encodeIco(canvas)
    case 'pdf':
      return imageCanvasToPdf(canvas)
    case 'gif':
      return encodeGif(canvas)
    case 'tiff':
      return encodeTiff(canvas)
    case 'bmp':
      return encodeBmp(canvas)
    case 'avif':
      // Some browsers can't encode AVIF; surface a clear error.
      return canvasToBlob(canvas, 'image/avif', quality).catch(() => {
        throw new Error('Этот браузер не умеет кодировать AVIF — попробуйте другой формат')
      })
    default:
      return canvasToBlob(canvas, getMime(to), quality)
  }
}

async function encodeGif(canvas) {
  // gifenc's export shape varies across bundlers; find the object that has the API.
  const mod = await import('gifenc')
  const lib = [mod, mod.default, mod.default?.default].find(
    (o) => o && typeof o.quantize === 'function',
  )
  const { GIFEncoder, quantize, applyPalette } = lib
  const { width, height } = canvas
  const data = canvas.getContext('2d').getImageData(0, 0, width, height).data
  const palette = quantize(data, 256)
  const index = applyPalette(data, palette)
  const gif = GIFEncoder()
  gif.writeFrame(index, width, height, { palette })
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}

async function encodeTiff(canvas) {
  const mod = await import('utif')
  const UTIF = mod.default ?? mod
  const { width, height } = canvas
  const rgba = canvas.getContext('2d').getImageData(0, 0, width, height).data
  const tiff = UTIF.encodeImage(rgba.buffer, width, height)
  return new Blob([tiff], { type: 'image/tiff' })
}

/** Minimal 24-bit BMP encoder (Canvas can't reliably toBlob image/bmp). */
function encodeBmp(canvas) {
  const { width: w, height: h } = canvas
  const rgba = canvas.getContext('2d').getImageData(0, 0, w, h).data
  const rowSize = Math.floor((24 * w + 31) / 32) * 4
  const pixelArraySize = rowSize * h
  const fileSize = 54 + pixelArraySize
  const buf = new ArrayBuffer(fileSize)
  const view = new DataView(buf)
  // BITMAPFILEHEADER
  view.setUint8(0, 0x42)
  view.setUint8(1, 0x4d)
  view.setUint32(2, fileSize, true)
  view.setUint32(10, 54, true)
  // BITMAPINFOHEADER
  view.setUint32(14, 40, true)
  view.setInt32(18, w, true)
  view.setInt32(22, h, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(34, pixelArraySize, true)
  const bytes = new Uint8Array(buf)
  for (let y = 0; y < h; y++) {
    const dstRow = 54 + (h - 1 - y) * rowSize // BMP is bottom-up
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4
      const d = dstRow + x * 3
      bytes[d] = rgba[s + 2] // B
      bytes[d + 1] = rgba[s + 1] // G
      bytes[d + 2] = rgba[s] // R
    }
  }
  return new Blob([buf], { type: 'image/bmp' })
}

/** Build a (PNG-based) .ico from a canvas. */
async function encodeIco(srcCanvas) {
  const sizes = [256, 128, 64, 48, 32, 16]
  const pngs = []
  for (const size of sizes) {
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
  view.setUint16(0, 0, true)
  view.setUint16(2, 1, true)
  view.setUint16(4, count, true)
  pngs.forEach((p, i) => {
    const e = 6 + i * 16
    view.setUint8(e, p.size >= 256 ? 0 : p.size)
    view.setUint8(e + 1, p.size >= 256 ? 0 : p.size)
    view.setUint8(e + 2, 0)
    view.setUint8(e + 3, 0)
    view.setUint16(e + 4, 1, true)
    view.setUint16(e + 6, 32, true)
    view.setUint32(e + 8, p.data.length, true)
    view.setUint32(e + 12, offset, true)
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
