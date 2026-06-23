import { useState } from 'react'
import { Download, Loader2, Images, FileOutput } from 'lucide-react'
import Dropzone from '../Dropzone.jsx'
import { pdfToImages, imagesToPdf } from '../../lib/pdfTools.js'
import { downloadBlob, downloadZip, formatBytes } from '../../lib/utils.js'

export default function ConvertTool() {
  const [mode, setMode] = useState('toImages') // 'toImages' | 'toPdf'

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button className={mode === 'toImages' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMode('toImages')}>
          PDF → изображения
        </button>
        <button className={mode === 'toPdf' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMode('toPdf')}>
          Изображения → PDF
        </button>
      </div>
      {mode === 'toImages' ? <PdfToImages /> : <ImagesToPdf />}
    </div>
  )
}

function PdfToImages() {
  const [file, setFile] = useState(null)
  const [format, setFormat] = useState('png')
  const [scale, setScale] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const imgs = await pdfToImages(file, { format, scale: Number(scale) })
      if (imgs.length === 1) downloadBlob(imgs[0].blob, imgs[0].name)
      else await downloadZip(imgs, file.name.replace(/\.pdf$/i, `_${format}.zip`))
    } catch (e) {
      setError(e?.message || 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  if (!file) {
    return <Dropzone onFiles={(f) => setFile(f[0])} accept="application/pdf,.pdf" multiple={false} hint="Один PDF-файл" />
  }
  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-400">{file.name} · {formatBytes(file.size)}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Формат</label>
          <select className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
          </select>
        </div>
        <div>
          <label className="label">Качество рендера ({scale}x)</label>
          <input type="range" min="1" max="4" step="0.5" className="w-full accent-indigo-500" value={scale} onChange={(e) => setScale(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-ghost" onClick={() => setFile(null)}>Другой файл</button>
        <button className="btn-primary" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Images size={16} />} Конвертировать
        </button>
      </div>
    </div>
  )
}

function ImagesToPdf() {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const blob = await imagesToPdf(files)
      downloadBlob(blob, 'images.pdf')
    } catch (e) {
      setError(e?.message || 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Dropzone
        onFiles={(f) => setFiles((p) => [...p, ...f])}
        accept="image/*"
        hint="PNG, JPG, WEBP, BMP — каждое станет страницей"
      />
      {files.length > 0 && (
        <>
          <ul className="space-y-1 text-sm text-slate-300">
            {files.map((f, i) => (
              <li key={i} className="flex justify-between">
                <span className="truncate">{i + 1}. {f.name}</span>
                <span className="text-slate-500">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setFiles([])}>Очистить</button>
            <button className="btn-primary" onClick={run} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={16} /> : <FileOutput size={16} />}
              Создать PDF ({files.length})
            </button>
          </div>
        </>
      )}
    </div>
  )
}
