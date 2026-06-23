import { useState } from 'react'
import { Download, Loader2, Stamp } from 'lucide-react'
import Dropzone from '../Dropzone.jsx'
import { addWatermark, addText, addImage, getPageCount } from '../../lib/pdfTools.js'
import { getExtension } from '../../lib/utils.js'
import { downloadBlob, formatBytes } from '../../lib/utils.js'

export default function StampTool() {
  const [file, setFile] = useState(null)
  const [count, setCount] = useState(1)
  const [mode, setMode] = useState('watermark')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // shared field state
  const [wmText, setWmText] = useState('КОНФИДЕНЦИАЛЬНО')
  const [opacity, setOpacity] = useState(0.18)
  const [text, setText] = useState('')
  const [page, setPage] = useState(1)
  const [x, setX] = useState(72)
  const [y, setY] = useState(72)
  const [size, setSize] = useState(24)
  const [stampImg, setStampImg] = useState(null)
  const [imgW, setImgW] = useState(160)

  async function load(files) {
    const f = files[0]
    setError(null)
    try {
      setCount(await getPageCount(f))
      setFile(f)
    } catch (e) {
      setError('Не удалось открыть PDF: ' + (e?.message || ''))
    }
  }

  async function run() {
    setBusy(true)
    setError(null)
    try {
      let blob
      if (mode === 'watermark') {
        blob = await addWatermark(file, wmText, { opacity: Number(opacity) })
      } else if (mode === 'text') {
        blob = await addText(file, {
          page: Number(page),
          x: Number(x),
          y: Number(y),
          text,
          size: Number(size),
        })
      } else {
        if (!stampImg) throw new Error('Загрузите изображение или подпись (PNG/JPG)')
        const ext = getExtension(stampImg.name)
        const imageBytes = new Uint8Array(await stampImg.arrayBuffer())
        blob = await addImage(file, {
          page: Number(page),
          imageBytes,
          imageType: ext === 'png' ? 'png' : 'jpg',
          x: Number(x),
          y: Number(y),
          width: Number(imgW),
        })
      }
      downloadBlob(blob, file.name.replace(/\.pdf$/i, '_stamped.pdf'))
    } catch (e) {
      setError(e?.message || 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  if (!file) {
    return <Dropzone onFiles={load} accept="application/pdf,.pdf" multiple={false} hint="Один PDF-файл" />
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-400">
        {file.name} · {formatBytes(file.size)} · {count} стр.
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['watermark', 'Водяной знак'],
          ['text', 'Текст'],
          ['image', 'Изображение / подпись'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={mode === id ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'watermark' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Текст водяного знака</label>
            <input className="input" value={wmText} onChange={(e) => setWmText(e.target.value)} />
          </div>
          <div>
            <label className="label">Прозрачность ({Math.round(opacity * 100)}%)</label>
            <input
              type="range" min="0.05" max="0.6" step="0.01"
              className="w-full accent-indigo-500"
              value={opacity} onChange={(e) => setOpacity(e.target.value)}
            />
          </div>
        </div>
      )}

      {mode === 'text' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Текст</label>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Введите текст" />
          </div>
          <NumField label="Страница" value={page} onChange={setPage} min={1} max={count} />
          <NumField label="Размер шрифта" value={size} onChange={setSize} min={6} max={96} />
          <NumField label="X (слева, pt)" value={x} onChange={setX} />
          <NumField label="Y (сверху, pt)" value={y} onChange={setY} />
        </div>
      )}

      {mode === 'image' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Изображение / подпись (PNG, JPG)</label>
            <input
              type="file" accept="image/png,image/jpeg"
              className="input"
              onChange={(e) => setStampImg(e.target.files?.[0] || null)}
            />
          </div>
          <NumField label="Страница" value={page} onChange={setPage} min={1} max={count} />
          <NumField label="Ширина (pt)" value={imgW} onChange={setImgW} min={10} />
          <NumField label="X (слева, pt)" value={x} onChange={setX} />
          <NumField label="Y (сверху, pt)" value={y} onChange={setY} />
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button className="btn-ghost" onClick={() => setFile(null)}>Другой файл</button>
        <button className="btn-primary" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Stamp size={16} />}
          Применить и скачать
        </button>
      </div>
    </div>
  )
}

function NumField({ label, value, onChange, min, max }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number" min={min} max={max}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
