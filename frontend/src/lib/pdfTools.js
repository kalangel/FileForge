// PDF manipulation via pdf-lib (all client-side).

import {
  PDFDocument,
  degrees,
  rgb,
  StandardFonts,
} from 'pdf-lib'

async function load(file) {
  const bytes = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer())
  return await PDFDocument.load(bytes, { ignoreEncryption: true })
}

function toBlob(bytes) {
  return new Blob([bytes], { type: 'application/pdf' })
}

/** Merge several PDF files (in order) into one. */
export async function mergePdfs(files) {
  const out = await PDFDocument.create()
  for (const file of files) {
    const doc = await load(file)
    const pages = await out.copyPages(doc, doc.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  return toBlob(await out.save())
}

/**
 * Split a PDF into ranges. `ranges` is an array of [start,end] (1-based, inclusive).
 * Returns an array of { name, blob }.
 */
export async function splitPdf(file, ranges) {
  const src = await load(file)
  const total = src.getPageCount()
  const results = []
  for (let r = 0; r < ranges.length; r++) {
    const [start, end] = ranges[r]
    const s = Math.max(1, start)
    const e = Math.min(total, end)
    if (s > e) continue
    const out = await PDFDocument.create()
    const indices = []
    for (let i = s; i <= e; i++) indices.push(i - 1)
    const pages = await out.copyPages(src, indices)
    pages.forEach((p) => out.addPage(p))
    results.push({ name: `pages_${s}-${e}.pdf`, blob: toBlob(await out.save()) })
  }
  return results
}

/** Extract one page per file (split into single pages). */
export async function explodePages(file) {
  const src = await load(file)
  const total = src.getPageCount()
  const ranges = []
  for (let i = 1; i <= total; i++) ranges.push([i, i])
  return splitPdf(file, ranges)
}

/**
 * Rebuild a PDF from an explicit page order with optional per-page rotation.
 * `order`: array of { index (0-based, original), rotate (deg, optional) }.
 * Pages not listed are dropped — this powers delete + reorder + rotate.
 */
export async function rebuildPages(file, order) {
  const src = await load(file)
  const out = await PDFDocument.create()
  const indices = order.map((o) => o.index)
  const copied = await out.copyPages(src, indices)
  copied.forEach((page, i) => {
    const rot = order[i].rotate || 0
    if (rot) {
      const current = page.getRotation().angle
      page.setRotation(degrees((current + rot) % 360))
    }
    out.addPage(page)
  })
  return toBlob(await out.save())
}

/** Add a diagonal text watermark to every page. */
export async function addWatermark(file, text, opts = {}) {
  const doc = await load(file)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const { opacity = 0.18, size = 48, color = [0.5, 0.5, 0.5] } = opts
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    page.drawText(text, {
      x: width / 2 - text.length * size * 0.22,
      y: height / 2,
      size,
      font,
      color: rgb(color[0], color[1], color[2]),
      rotate: degrees(45),
      opacity,
    })
  }
  return toBlob(await doc.save())
}

/** Draw text at an absolute position on a given page (1-based). */
export async function addText(file, { page = 1, x, y, text, size = 16, color = [0, 0, 0] }) {
  const doc = await load(file)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const target = doc.getPage(page - 1)
  const { height } = target.getSize()
  target.drawText(text, {
    x,
    y: height - y, // accept top-left origin from the UI
    size,
    font,
    color: rgb(color[0], color[1], color[2]),
  })
  return toBlob(await doc.save())
}

/** Stamp an image (PNG/JPG bytes) onto a page. */
export async function addImage(file, { page = 1, imageBytes, imageType, x, y, width, height }) {
  const doc = await load(file)
  const img =
    imageType === 'png' ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes)
  const target = doc.getPage(page - 1)
  const pageH = target.getSize().height
  const dims = img.scale(1)
  const w = width || dims.width
  const h = height || dims.height
  target.drawImage(img, { x, y: pageH - y - h, width: w, height: h })
  return toBlob(await doc.save())
}

/** Rasterise + re-embed pages at a target scale to shrink file size. */
export async function compressPdf(file, { scale = 1, quality = 0.7 } = {}) {
  const { loadPdf, renderPageToCanvas } = await import('./pdfRender.js')
  const pdf = await loadPdf(file)
  const out = await PDFDocument.create()
  for (let i = 1; i <= pdf.numPages; i++) {
    const canvas = await renderPageToCanvas(pdf, i, scale)
    const jpgBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
    const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer())
    const img = await out.embedJpg(jpgBytes)
    const page = out.addPage([canvas.width, canvas.height])
    page.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height })
  }
  return toBlob(await out.save())
}

/** Read PDF form fields and their current values. */
export async function getFormFields(file) {
  const doc = await load(file)
  const form = doc.getForm()
  return form.getFields().map((f) => ({
    name: f.getName(),
    type: f.constructor.name,
  }))
}

/** Fill a flat map of { fieldName: value } into a PDF form. */
export async function fillForm(file, values, { flatten = false } = {}) {
  const doc = await load(file)
  const form = doc.getForm()
  for (const [name, value] of Object.entries(values)) {
    const field = form.getFieldMaybe?.(name) ?? safeGetField(form, name)
    if (!field) continue
    const kind = field.constructor.name
    try {
      if (kind === 'PDFTextField') field.setText(String(value))
      else if (kind === 'PDFCheckBox') value ? field.check() : field.uncheck()
      else if (kind === 'PDFDropdown' || kind === 'PDFOptionList') field.select(String(value))
      else if (kind === 'PDFRadioGroup') field.select(String(value))
    } catch {
      /* skip fields that reject the value */
    }
  }
  if (flatten) form.flatten()
  return toBlob(await doc.save())
}

function safeGetField(form, name) {
  try {
    return form.getField(name)
  } catch {
    return null
  }
}

/** Convert each PDF page to an image Blob. Returns [{ name, blob }]. */
export async function pdfToImages(file, { format = 'png', scale = 2, quality = 0.92 } = {}) {
  const { loadPdf, renderPageToImageBlob } = await import('./pdfRender.js')
  const pdf = await loadPdf(file)
  const type = format === 'jpg' ? 'image/jpeg' : 'image/png'
  const results = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const blob = await renderPageToImageBlob(pdf, i, { scale, type, quality })
    results.push({ name: `page_${i}.${format}`, blob })
  }
  return results
}

/** Build a PDF from a list of image files (one image per page). */
export async function imagesToPdf(files) {
  const doc = await PDFDocument.create()
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const isPng = file.type.includes('png') || file.name.toLowerCase().endsWith('.png')
    let img
    try {
      img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
    } catch {
      // Fallback: rasterise via canvas (handles webp/bmp/etc).
      const { convertImage } = await import('./imageConverter.js')
      const pngBlob = await convertImage(file, { to: 'png' })
      img = await doc.embedPng(new Uint8Array(await pngBlob.arrayBuffer()))
    }
    const page = doc.addPage([img.width, img.height])
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
  }
  return toBlob(await doc.save())
}

export async function getPageCount(file) {
  const doc = await load(file)
  return doc.getPageCount()
}
