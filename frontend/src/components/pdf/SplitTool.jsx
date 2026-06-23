import { useState } from 'react'
import { Download, Loader2, Scissors } from 'lucide-react'
import Dropzone from '../Dropzone.jsx'
import { splitPdf, explodePages, getPageCount } from '../../lib/pdfTools.js'
import { downloadBlob, downloadZip, formatBytes } from '../../lib/utils.js'
import { useDirtyFile } from './DirtyContext.js'

/** Parse "1-3, 5, 8-10" into [[1,3],[5,5],[8,10]]. */
function parseRanges(input, max) {
  const ranges = []
  for (const part of input.split(',')) {
    const t = part.trim()
    if (!t) continue
    const m = t.match(/^(\d+)\s*-\s*(\d+)$/)
    if (m) ranges.push([Number(m[1]), Number(m[2])])
    else if (/^\d+$/.test(t)) ranges.push([Number(t), Number(t)])
  }
  return ranges.filter(([s, e]) => s >= 1 && e <= max && s <= e)
}

export default function SplitTool() {
  const [file, setFile] = useState(null)
  const [count, setCount] = useState(0)
  const [mode, setMode] = useState('ranges')
  const [ranges, setRanges] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  useDirtyFile(Boolean(file))

  async function load(files) {
    const f = files[0]
    setError(null)
    try {
      const n = await getPageCount(f)
      setFile(f)
      setCount(n)
      setRanges(`1-${n}`)
    } catch (e) {
      setError('Не удалось открыть PDF: ' + (e?.message || ''))
    }
  }

  async function run() {
    setBusy(true)
    setError(null)
    try {
      let results
      if (mode === 'explode') {
        results = await explodePages(file)
      } else {
        const parsed = parseRanges(ranges, count)
        if (!parsed.length) throw new Error('Укажите корректные диапазоны, напр. 1-3, 5')
        results = await splitPdf(file, parsed)
      }
      if (results.length === 1) downloadBlob(results[0].blob, results[0].name)
      else await downloadZip(results, 'split.zip')
    } catch (e) {
      setError(e?.message || 'Ошибка разделения')
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

      <div className="flex gap-2">
        <button
          className={mode === 'ranges' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setMode('ranges')}
        >
          По диапазонам
        </button>
        <button
          className={mode === 'explode' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setMode('explode')}
        >
          Каждая страница отдельно
        </button>
      </div>

      {mode === 'ranges' && (
        <div>
          <label className="label">Диапазоны (через запятую)</label>
          <input
            className="input"
            value={ranges}
            onChange={(e) => setRanges(e.target.value)}
            placeholder="напр. 1-3, 5, 8-10"
          />
          <p className="mt-1 text-xs text-slate-500">
            Каждый диапазон станет отдельным PDF. Несколько файлов скачаются как .zip
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button className="btn-ghost" onClick={() => setFile(null)}>
          Другой файл
        </button>
        <button className="btn-primary" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Scissors size={16} />}
          Разделить
        </button>
      </div>
    </div>
  )
}
