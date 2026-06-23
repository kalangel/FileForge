// Small shared helpers used across the app.

/** Human-readable file size. */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes < 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

/** Human-readable duration in ms. */
export function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)} мс`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} с`
  const m = Math.floor(s / 60)
  return `${m} мин ${Math.round(s % 60)} с`
}

/** Lowercase extension without dot, from a filename. */
export function getExtension(name = '') {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

/** Replace (or add) the extension on a filename. */
export function withExtension(name, ext) {
  const base = name.replace(/\.[^.]+$/, '')
  return `${base}.${ext}`
}

/** Trigger a browser download for a Blob or Uint8Array. */
export function downloadBlob(data, filename, mime) {
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a tick before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Rough estimate of processing time, used to set user expectations. */
export function estimateTime(bytes, kind) {
  const mb = bytes / (1024 * 1024)
  // Very rough throughput guesses (MB/s) per workload type.
  const throughput = { image: 12, pdf: 8, doc: 6, audio: 4, video: 1.2 }[kind] || 6
  const seconds = Math.max(0.3, mb / throughput)
  return seconds
}

/** Format an estimate as a friendly range. */
export function estimateLabel(bytes, kind) {
  const s = estimateTime(bytes, kind)
  if (s < 1) return '≈ меньше секунды'
  if (s < 60) return `≈ ${Math.ceil(s)} с`
  return `≈ ${Math.ceil(s / 60)} мин`
}

export function uid() {
  return Math.random().toString(36).slice(2, 10)
}

/** Bundle [{name, blob}] into a single .zip and download it. */
export async function downloadZip(entries, zipName) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (const { name, blob } of entries) {
    zip.file(name, blob)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  downloadBlob(content, zipName)
}
