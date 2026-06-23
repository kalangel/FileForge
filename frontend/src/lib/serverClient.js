// Thin client for the FastAPI backend (used only for formats the browser
// cannot handle: TIFF/ICO decode, ODT/RTF, password-protected PDFs, etc.).

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export async function serverConvert(file, to, fromExt) {
  const form = new FormData()
  form.append('file', file)
  form.append('target', to)
  if (fromExt) form.append('source', fromExt)

  const res = await fetch(`${API_BASE}/convert`, { method: 'POST', body: form })
  if (!res.ok) {
    const msg = await safeError(res)
    throw new Error(msg || `Сервер вернул ошибку ${res.status}`)
  }
  return await res.blob()
}

async function safeError(res) {
  try {
    const data = await res.json()
    return data.detail || data.error
  } catch {
    return null
  }
}
