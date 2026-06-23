import { useState } from 'react'
import { Download, Loader2, Minimize2 } from 'lucide-react'
import Dropzone from '../Dropzone.jsx'
import { compressPdf } from '../../lib/pdfTools.js'
import { downloadBlob, formatBytes } from '../../lib/utils.js'
import { useDirtyFile } from './DirtyContext.js'

const LEVELS = {
  low: { label: 'Лёгкое (лучше качество)', scale: 1.5, quality: 0.8 },
  medium: { label: 'Среднее', scale: 1.1, quality: 0.6 },
  high: { label: 'Сильное (меньше размер)', scale: 0.9, quality: 0.45 },
}

export default function CompressTool() {
  const [file, setFile] = useState(null)
  const [level, setLevel] = useState('medium')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  useDirtyFile(Boolean(file))

  async function run() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const { scale, quality } = LEVELS[level]
      const blob = await compressPdf(file, { scale, quality })
      setResult(blob)
    } catch (e) {
      setError(e?.message || 'Ошибка сжатия')
    } finally {
      setBusy(false)
    }
  }

  if (!file) {
    return <Dropzone onFiles={(f) => { setFile(f[0]); setResult(null) }} accept="application/pdf,.pdf" multiple={false} hint="Один PDF-файл" />
  }

  const saved = result ? 1 - result.size / file.size : 0

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-400">{file.name} · {formatBytes(file.size)}</div>

      <div>
        <label className="label">Уровень сжатия</label>
        <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
          {Object.entries(LEVELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Страницы перерисовываются как изображения. Текст перестаёт быть выделяемым, но размер заметно уменьшается.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {result && (
        <div className="card p-3 text-sm">
          <p className="text-slate-300">
            Было {formatBytes(file.size)} → стало <span className="text-emerald-400">{formatBytes(result.size)}</span>
            {saved > 0 && <span className="text-emerald-400"> (−{Math.round(saved * 100)}%)</span>}
            {saved <= 0 && <span className="text-amber-400"> (файл уже хорошо сжат)</span>}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn-ghost" onClick={() => { setFile(null); setResult(null) }}>Другой файл</button>
        {result ? (
          <button className="btn-primary" onClick={() => downloadBlob(result, file.name.replace(/\.pdf$/i, '_compressed.pdf'))}>
            <Download size={16} /> Скачать
          </button>
        ) : (
          <button className="btn-primary" onClick={run} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Minimize2 size={16} />} Сжать
          </button>
        )}
      </div>
    </div>
  )
}
