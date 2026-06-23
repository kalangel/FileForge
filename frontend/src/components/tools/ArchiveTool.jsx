import { useState } from 'react'
import { FolderArchive, PackageOpen, Download, X, Loader2 } from 'lucide-react'
import Dropzone from '../Dropzone.jsx'
import { downloadBlob, downloadZip, formatBytes, uid } from '../../lib/utils.js'

export default function ArchiveTool() {
  const [mode, setMode] = useState('create') // create | extract
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button className={mode === 'create' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMode('create')}>
          <FolderArchive size={16} /> Создать ZIP
        </button>
        <button className={mode === 'extract' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMode('extract')}>
          <PackageOpen size={16} /> Распаковать ZIP
        </button>
      </div>
      {mode === 'create' ? <CreateZip /> : <ExtractZip />}
    </div>
  )
}

function CreateZip() {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const add = (list) => setFiles((p) => [...p, ...list.map((file) => ({ id: uid(), file }))])
  const remove = (id) => setFiles((p) => p.filter((f) => f.id !== id))

  async function run() {
    setBusy(true)
    try {
      await downloadZip(files.map((f) => ({ name: f.file.name, blob: f.file })), 'archive.zip')
    } finally {
      setBusy(false)
    }
  }

  const total = files.reduce((s, f) => s + f.file.size, 0)

  return (
    <div className="space-y-4">
      <Dropzone onFiles={add} hint="Любые файлы — будут упакованы в один .zip" />
      {files.length > 0 && (
        <>
          <ul className="space-y-1 text-sm">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-lg bg-ink-850 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-slate-200">{f.file.name}</span>
                <span className="mx-3 text-xs text-slate-500">{formatBytes(f.file.size)}</span>
                <button className="text-slate-500 hover:text-red-400" onClick={() => remove(f.id)}><X size={15} /></button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{files.length} файлов · {formatBytes(total)}</span>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setFiles([])}>Очистить</button>
              <button className="btn-primary" onClick={run} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" size={16} /> : <FolderArchive size={16} />} Скачать ZIP
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ExtractZip() {
  const [entries, setEntries] = useState([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function load(files) {
    const f = files[0]
    setError(null)
    setBusy(true)
    setEntries([])
    setName(f.name)
    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(f)
      const list = []
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue
        const blob = await entry.async('blob')
        list.push({ name: path, blob, size: blob.size })
      }
      setEntries(list)
    } catch (e) {
      setError('Не удалось открыть архив: ' + (e?.message || ''))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Dropzone onFiles={load} accept=".zip,application/zip" multiple={false} hint="Перетащите .zip — увидите содержимое" />
      {busy && <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="animate-spin" size={16} /> Чтение архива…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {entries.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">{name} · {entries.length} файлов</span>
            <button className="btn-ghost" onClick={() => downloadZip(entries, name.replace(/\.zip$/i, '') + '_repacked.zip')}>
              <Download size={15} /> Скачать всё
            </button>
          </div>
          <ul className="space-y-1 text-sm">
            {entries.map((e, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-ink-850 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-slate-200">{e.name}</span>
                <span className="mx-3 text-xs text-slate-500">{formatBytes(e.size)}</span>
                <button className="btn-ghost py-1" onClick={() => downloadBlob(e.blob, e.name.split('/').pop())}>
                  <Download size={14} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
