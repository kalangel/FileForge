import { useState } from 'react'
import { Download, Loader2, FileText, Copy, Check } from 'lucide-react'
import Dropzone from '../Dropzone.jsx'
import { extractText } from '../../lib/pdfRender.js'
import { pdfToImages } from '../../lib/pdfTools.js'
import { downloadBlob, downloadZip, formatBytes } from '../../lib/utils.js'
import { useDirtyFile } from './DirtyContext.js'

export default function ExtractTool() {
  const [file, setFile] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  useDirtyFile(Boolean(file))

  async function load(files) {
    const f = files[0]
    setFile(f)
    setError(null)
    setText('')
    setBusy(true)
    try {
      setText(await extractText(f))
    } catch (e) {
      setError('Не удалось извлечь текст: ' + (e?.message || ''))
    } finally {
      setBusy(false)
    }
  }

  async function extractImages() {
    setBusy(true)
    setError(null)
    try {
      // Render each page to PNG (true embedded-image extraction needs the backend).
      const imgs = await pdfToImages(file, { format: 'png', scale: 2 })
      await downloadZip(imgs, file.name.replace(/\.pdf$/i, '_images.zip'))
    } catch (e) {
      setError(e?.message || 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!file) {
    return <Dropzone onFiles={load} accept="application/pdf,.pdf" multiple={false} hint="Один PDF-файл" />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-400">{file.name} · {formatBytes(file.size)}</div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setFile(null)}>Другой файл</button>
          <button className="btn-ghost" onClick={extractImages} disabled={busy}>
            <Download size={15} /> Страницы как PNG
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {busy && !text ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="animate-spin" size={16} /> Извлечение…
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={copy} disabled={!text}>
              {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
            <button
              className="btn-primary"
              onClick={() => downloadBlob(new Blob([text], { type: 'text/plain' }), file.name.replace(/\.pdf$/i, '.txt'))}
              disabled={!text}
            >
              <FileText size={15} /> Скачать .txt
            </button>
          </div>
          <textarea
            className="input h-80 font-mono text-xs"
            value={text}
            readOnly
            placeholder="Текст не найден (возможно, это скан без текстового слоя)"
          />
        </>
      )}
    </div>
  )
}
