import { useEffect, useState } from 'react'
import {
  RotateCw,
  RotateCcw,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Download,
  Loader2,
} from 'lucide-react'
import Dropzone from '../Dropzone.jsx'
import { loadPdf, renderPageToDataUrl } from '../../lib/pdfRender.js'
import { rebuildPages } from '../../lib/pdfTools.js'
import { downloadBlob, withExtension, formatBytes } from '../../lib/utils.js'

export default function PagesTool() {
  const [file, setFile] = useState(null)
  const [pages, setPages] = useState([]) // { origIndex, rotate, thumb }
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function load(files) {
    const f = files[0]
    setFile(f)
    setError(null)
    setLoading(true)
    setPages([])
    try {
      const pdf = await loadPdf(f)
      const list = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const thumb = await renderPageToDataUrl(pdf, i, 0.4)
        list.push({ origIndex: i - 1, rotate: 0, thumb })
      }
      setPages(list)
    } catch (e) {
      setError('Не удалось открыть PDF: ' + (e?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  const rotate = (i, deg) =>
    setPages((p) => p.map((pg, idx) => (idx === i ? { ...pg, rotate: (pg.rotate + deg + 360) % 360 } : pg)))
  const remove = (i) => setPages((p) => p.filter((_, idx) => idx !== i))
  const move = (i, dir) =>
    setPages((p) => {
      const j = i + dir
      if (j < 0 || j >= p.length) return p
      const copy = [...p]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })

  async function save() {
    if (!pages.length) return
    setSaving(true)
    setError(null)
    try {
      const blob = await rebuildPages(
        file,
        pages.map((p) => ({ index: p.origIndex, rotate: p.rotate })),
      )
      downloadBlob(blob, withExtension(file.name, 'pdf').replace('.pdf', '_edited.pdf'))
    } catch (e) {
      setError('Ошибка при сохранении: ' + (e?.message || ''))
    } finally {
      setSaving(false)
    }
  }

  if (!file) {
    return <Dropzone onFiles={load} accept="application/pdf,.pdf" multiple={false} hint="Один PDF-файл" />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-400">
          {file.name} · {formatBytes(file.size)} · {pages.length} стр.
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => { setFile(null); setPages([]) }}>
            Другой файл
          </button>
          <button className="btn-primary" onClick={save} disabled={saving || !pages.length}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            Сохранить PDF
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="animate-spin" size={16} /> Рендеринг страниц…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {pages.map((pg, i) => (
            <div key={`${pg.origIndex}-${i}`} className="card overflow-hidden">
              <div className="flex items-center justify-center bg-ink-950 p-2">
                <img
                  src={pg.thumb}
                  alt={`page ${i + 1}`}
                  className="max-h-44 w-auto rounded shadow"
                  style={{ transform: `rotate(${pg.rotate}deg)` }}
                />
              </div>
              <div className="flex items-center justify-between gap-1 border-t border-ink-700 px-2 py-1.5">
                <span className="text-xs text-slate-500">#{i + 1}</span>
                <div className="flex gap-0.5">
                  <IconBtn title="Влево" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowLeft size={14} />
                  </IconBtn>
                  <IconBtn title="Вправо" onClick={() => move(i, 1)} disabled={i === pages.length - 1}>
                    <ArrowRight size={14} />
                  </IconBtn>
                  <IconBtn title="Повернуть влево" onClick={() => rotate(i, -90)}>
                    <RotateCcw size={14} />
                  </IconBtn>
                  <IconBtn title="Повернуть вправо" onClick={() => rotate(i, 90)}>
                    <RotateCw size={14} />
                  </IconBtn>
                  <IconBtn title="Удалить" onClick={() => remove(i)} danger>
                    <Trash2 size={14} />
                  </IconBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IconBtn({ children, onClick, disabled, danger, title }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded p-1 transition-colors disabled:opacity-30',
        danger ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:bg-ink-700',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
