// PDF rendering & text extraction via pdf.js.

import * as pdfjsLib from 'pdfjs-dist'
// Vite resolves this to a hashed worker URL at build time.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/** Load a pdf.js document from a File/Blob/ArrayBuffer. */
export async function loadPdf(input) {
  const data = input instanceof ArrayBuffer ? input : await input.arrayBuffer()
  // pdf.js transfers the buffer; clone so callers can still use the original.
  return await pdfjsLib.getDocument({ data: data.slice(0) }).promise
}

/** Render a single page to a canvas and return it. */
export async function renderPageToCanvas(pdf, pageNum, scale = 1.2) {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas
}

/** Render a page to a data URL (for thumbnails / previews). */
export async function renderPageToDataUrl(pdf, pageNum, scale = 0.5) {
  const canvas = await renderPageToCanvas(pdf, pageNum, scale)
  return canvas.toDataURL('image/png')
}

/** Render a page to an image Blob of the given format. */
export async function renderPageToImageBlob(pdf, pageNum, { scale = 2, type = 'image/png', quality = 0.92 } = {}) {
  const canvas = await renderPageToCanvas(pdf, pageNum, scale)
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), type, quality),
  )
}

/** Extract all text from a PDF (page-by-page, newline-separated). */
export async function extractText(input) {
  const pdf = await loadPdf(input)
  const out = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    out.push(content.items.map((it) => it.str).join(' '))
  }
  return out.join('\n\n')
}
