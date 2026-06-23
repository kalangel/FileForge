import { useEffect, useState } from 'react'
import { Download, Loader2, Lock, Unlock, Cloud, AlertTriangle } from 'lucide-react'
import Dropzone from '../Dropzone.jsx'
import { serverPdfPassword, serverHealthy } from '../../lib/serverClient.js'
import { downloadBlob, formatBytes } from '../../lib/utils.js'
import { useDirtyFile } from './DirtyContext.js'

export default function PasswordTool() {
  const [file, setFile] = useState(null)
  const [action, setAction] = useState('protect') // 'protect' | 'unlock'
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [online, setOnline] = useState(null)
  useDirtyFile(Boolean(file))

  useEffect(() => {
    serverHealthy().then(setOnline)
  }, [])

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const blob = await serverPdfPassword(file, { action, password })
      const suffix = action === 'protect' ? '_protected' : '_unlocked'
      downloadBlob(blob, file.name.replace(/\.pdf$/i, suffix + '.pdf'))
    } catch (e) {
      setError(e?.message || 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-start gap-2 border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
        <Cloud size={16} className="mt-0.5 shrink-0" />
        <div>
          Шифрование PDF нельзя выполнить в браузере, поэтому эта операция отправляет файл на
          локальный backend (FastAPI + pypdf).
          {online === false && (
            <span className="mt-1 flex items-center gap-1 text-red-400">
              <AlertTriangle size={14} /> Сервер недоступен — запустите backend (см. README).
            </span>
          )}
        </div>
      </div>

      {!file ? (
        <Dropzone onFiles={(f) => setFile(f[0])} accept="application/pdf,.pdf" multiple={false} hint="Один PDF-файл" />
      ) : (
        <>
          <div className="text-sm text-slate-400">{file.name} · {formatBytes(file.size)}</div>
          <div className="flex gap-2">
            <button className={action === 'protect' ? 'btn-primary' : 'btn-ghost'} onClick={() => setAction('protect')}>
              <Lock size={15} /> Установить пароль
            </button>
            <button className={action === 'unlock' ? 'btn-primary' : 'btn-ghost'} onClick={() => setAction('unlock')}>
              <Unlock size={15} /> Снять пароль
            </button>
          </div>
          <div>
            <label className="label">{action === 'protect' ? 'Новый пароль' : 'Текущий пароль'}</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setFile(null)}>Другой файл</button>
            <button className="btn-primary" onClick={run} disabled={busy || !password}>
              {busy ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              {action === 'protect' ? 'Зашифровать' : 'Расшифровать'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
