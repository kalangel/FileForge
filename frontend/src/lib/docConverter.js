// Client-side document & spreadsheet conversion.
//   docx -> html/txt/md/pdf   (mammoth)
//   md/html/txt interconvert  (marked / turndown)
//   xlsx/csv/ods              (SheetJS)
//   pdf -> txt                (pdf.js, via pdfRender)

import { normalizeExt } from './formats.js'

// ---------- Documents ----------

async function fileToText(file) {
  return await file.text()
}

function htmlToPlain(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

async function markdownToHtml(md) {
  const { marked } = await import('marked')
  return marked.parse(md)
}

async function htmlToMarkdown(html) {
  const TurndownService = (await import('turndown')).default
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  return td.turndown(html)
}

async function docxToHtml(file) {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const { value } = await mammoth.convertToHtml({ arrayBuffer })
  return value
}

/** Render HTML into a downloadable PDF using jsPDF's html pipeline. */
async function htmlToPdf(html, filename = 'document') {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const container = document.createElement('div')
  container.style.width = '520px'
  container.style.fontFamily = 'Helvetica, Arial, sans-serif'
  container.style.fontSize = '12px'
  container.style.lineHeight = '1.5'
  container.style.color = '#000'
  container.innerHTML = html

  await doc.html(container, {
    autoPaging: 'text',
    margin: [36, 36, 36, 36],
    width: 520,
    windowWidth: 520,
  })
  return doc.output('blob')
}

/** Convert a document file to the requested target. Returns a Blob. */
export async function convertDocument(file, to, fromExt) {
  const from = normalizeExt(fromExt)
  to = normalizeExt(to)

  // Normalise source into an intermediate { html, text }.
  let html = null
  let text = null

  if (from === 'docx') {
    html = await docxToHtml(file)
  } else if (from === 'md') {
    text = await fileToText(file)
    html = await markdownToHtml(text)
  } else if (from === 'html') {
    html = await fileToText(file)
  } else if (from === 'txt') {
    text = await fileToText(file)
    html = `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(text)}</pre>`
  } else if (from === 'pdf') {
    const { extractText } = await import('./pdfRender.js')
    text = await extractText(file)
    html = `<pre style="white-space:pre-wrap">${escapeHtml(text)}</pre>`
  } else {
    throw new Error(`Конвертация ${from} не поддерживается в браузере`)
  }

  if (text == null) text = htmlToPlain(html)

  switch (to) {
    case 'html':
      return new Blob([wrapHtml(html)], { type: 'text/html' })
    case 'txt':
      return new Blob([text], { type: 'text/plain' })
    case 'md':
      return new Blob([await htmlToMarkdown(html)], { type: 'text/markdown' })
    case 'pdf':
      return await htmlToPdf(html, file.name)
    default:
      throw new Error(`Целевой формат ${to} не поддерживается`)
  }
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function wrapHtml(body) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`
}

// ---------- Spreadsheets ----------

export async function convertSpreadsheet(file, to, fromExt) {
  const XLSX = await import('xlsx')
  to = normalizeExt(to)
  const data = new Uint8Array(await file.arrayBuffer())
  const wb = XLSX.read(data, { type: 'array' })

  if (to === 'csv') {
    // Concatenate all sheets (CSV is single-table; most files have one sheet).
    const parts = wb.SheetNames.map((name) => XLSX.utils.sheet_to_csv(wb.Sheets[name]))
    return new Blob([parts.join('\n')], { type: 'text/csv' })
  }
  if (to === 'html') {
    const parts = wb.SheetNames.map(
      (name) => `<h3>${name}</h3>${XLSX.utils.sheet_to_html(wb.Sheets[name])}`,
    )
    return new Blob([wrapHtml(parts.join('\n'))], { type: 'text/html' })
  }
  if (to === 'xlsx') {
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    return new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  }
  throw new Error(`Целевой формат ${to} не поддерживается в браузере`)
}
