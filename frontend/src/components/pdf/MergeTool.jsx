import { useState } from 'react'
import { ArrowUp, ArrowDown, X, Download, Loader2, Combine } from 'lucide-react'
import Dropzone from '../Dropzone.jsx'
import { mergePdfs } from '../../lib/pdfTools.js'
import { downloadBlob, formatBytes, uid } from '../../lib/utils.js'
import { useDirtyFile } from './DirtyContext.js'

export default function MergeTool() {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  useDirtyFile(files.length > 0)

  const add = (list) =>
    setFiles((prev) => [...prev, ...list.map((file) => ({ id: uid(), file }))])
  const remove = (id) => setFiles((p) => p.filter((f) => f.id !== id))
  const move = (i, dir) =>
    setFiles((p) => {
      const j = i + dir
      if (j < 0 || j >= p.length) return p
      const c = [...p]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })

  async function run() {
    if (files.length < 2) return
    setBusy(true)
    setError(null)
    try {
      const blob = await mergePdfs(files.map((f) => f.file))
      downloadBlob(blob, 'merged.pdf')
    } catch (e) {
      setError('Не удалось объединить: ' + (e?.message || ''))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Dropzone onFiles={add} accept="application/pdf,.pdf" hint="Несколько PDF — порядок задаётся ниже" />
      {error && <p className="text-sm text-red-400">{error}</p>}
      {files.length > 0 && (
        <>
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li key={f.id} className="card flex items-center gap-2 p-2.5">
                <span className="w-6 text-center text-xs text-slate-500">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{f.file.name}</span>
                <span className="text-xs text-slate-500">{formatBytes(f.file.size)}</span>
                <button className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp size={15} />
                </button>
                <button className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === files.length - 1}>
                  <ArrowDown size={15} />
                </button>
                <button className="p-1 text-slate-500 hover:text-red-400" onClick={() => remove(f.id)}>
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>
          <button className="btn-primary" onClick={run} disabled={busy || files.length < 2}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Combine size={16} />}
            Объединить {files.length} файлов
          </button>
        </>
      )}
    </div>
  )
}
