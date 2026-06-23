import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { downloadBlob } from '../../lib/utils.js'

// Client-side QR generation via the `qrcode` library.
export default function QrTool() {
  const [text, setText] = useState('https://')
  const [size, setSize] = useState(320)
  const [dark, setDark] = useState('#0f1117')
  const [light, setLight] = useState('#ffffff')
  const [dataUrl, setDataUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function gen() {
      if (!text.trim()) {
        setDataUrl('')
        return
      }
      setBusy(true)
      setError(null)
      try {
        const mod = await import('qrcode')
        const QRCode = mod.default ?? mod
        const url = await QRCode.toDataURL(text, {
          width: Number(size),
          margin: 2,
          color: { dark, light },
          errorCorrectionLevel: 'M',
        })
        if (!cancelled) setDataUrl(url)
      } catch (e) {
        if (!cancelled) setError('Слишком много данных для QR-кода')
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    const t = setTimeout(gen, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [text, size, dark, light])

  async function downloadSvg() {
    const QRCode = (await import('qrcode')).default
    const svg = await QRCode.toString(text, { type: 'svg', margin: 2, color: { dark, light } })
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qr.svg')
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="label">Текст или ссылка</label>
          <textarea className="input h-28" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://example.com или любой текст" />
        </div>
        <div>
          <label className="label">Размер ({size}px)</label>
          <input type="range" min="128" max="640" step="16" value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-indigo-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="color" value={dark} onChange={(e) => setDark(e.target.value)} className="h-8 w-8 rounded border border-ink-700 bg-transparent" />
            Цвет кода
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="color" value={light} onChange={(e) => setLight(e.target.value)} className="h-8 w-8 rounded border border-ink-700 bg-transparent" />
            Фон
          </label>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <div className="flex flex-col items-center justify-center gap-4">
        <div className="grid h-64 w-64 place-items-center rounded-xl border border-ink-700 bg-white/5">
          {busy ? (
            <Loader2 className="animate-spin text-slate-400" />
          ) : dataUrl ? (
            <img src={dataUrl} alt="QR" className="max-h-60 max-w-60" />
          ) : (
            <span className="text-sm text-slate-500">Введите текст</span>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => downloadBlob(dataURLtoBlob(dataUrl), 'qr.png')} disabled={!dataUrl}>
            <Download size={16} /> PNG
          </button>
          <button className="btn-ghost" onClick={downloadSvg} disabled={!text.trim()}>
            <Download size={16} /> SVG
          </button>
        </div>
      </div>
    </div>
  )
}

function dataURLtoBlob(dataUrl) {
  const [head, body] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)[1]
  const bin = atob(body)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}
