import { useMemo, useState } from 'react'
import {
  Download,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Cloud,
  ShieldCheck,
  Settings2,
} from 'lucide-react'
import Dropzone from '../components/Dropzone.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { CATEGORIES } from '../lib/formats.js'
import {
  getExtension,
  withExtension,
  formatBytes,
  downloadBlob,
  formatDuration,
  estimateLabel,
  uid,
} from '../lib/utils.js'
import {
  getTargets,
  normalizeExt,
  getCategory,
  isSupported,
} from '../lib/formats.js'
import { runConversion, engineFor } from '../lib/convert.js'
import { RESOLUTION_PRESETS } from '../lib/imageConverter.js'

const ENGINE_BADGE = {
  canvas: { label: 'в браузере', cls: 'text-emerald-400', icon: ShieldCheck },
  doc: { label: 'в браузере', cls: 'text-emerald-400', icon: ShieldCheck },
  pdf: { label: 'в браузере', cls: 'text-emerald-400', icon: ShieldCheck },
  sheet: { label: 'в браузере', cls: 'text-emerald-400', icon: ShieldCheck },
  ffmpeg: { label: 'в браузере (ffmpeg)', cls: 'text-emerald-400', icon: ShieldCheck },
  server: { label: 'на сервере', cls: 'text-amber-400', icon: Cloud },
}

export default function Converter() {
  const [items, setItems] = useState([])
  const [imgOptions, setImgOptions] = useState({
    presetIdx: 0,
    width: '',
    height: '',
    keepRatio: true,
    quality: 0.92,
  })
  const [busy, setBusy] = useState(false)

  const hasImages = useMemo(
    () => items.some((it) => it.category === 'image'),
    [items],
  )

  function addFiles(files) {
    const next = files.map((file) => {
      const from = normalizeExt(getExtension(file.name))
      const category = getCategory(from)
      const supported = isSupported(from)
      const targets = supported ? getTargets(from) : []
      return {
        id: uid(),
        file,
        from,
        category,
        supported,
        targets,
        to: targets[0]?.to || '',
        status: supported && targets.length ? 'idle' : 'error',
        error: !supported
          ? `Формат .${from || '?'} не поддерживается`
          : targets.length === 0
            ? `Для .${from} нет доступных целевых форматов`
            : null,
        progress: null,
        resultBlob: null,
        resultName: null,
        elapsed: null,
      }
    })
    setItems((prev) => [...prev, ...next])
  }

  function updateItem(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  function buildImageOptions() {
    const preset = RESOLUTION_PRESETS[imgOptions.presetIdx]
    const width = imgOptions.width
      ? Number(imgOptions.width)
      : preset.width || null
    const height = imgOptions.height
      ? Number(imgOptions.height)
      : preset.height || null
    return {
      width,
      height,
      keepRatio: imgOptions.keepRatio,
      quality: Number(imgOptions.quality),
    }
  }

  async function convertOne(item) {
    if (item.status === 'error' && !item.targets.length) return
    const start = performance.now()
    updateItem(item.id, { status: 'running', progress: null, error: null })
    try {
      const options =
        item.category === 'image'
          ? buildImageOptions()
          : item.category === 'video' || item.category === 'audio'
            ? { onProgress: (p) => updateItem(item.id, { progress: p }) }
            : {}

      const { blob, engine, fellBack } = await runConversion({
        file: item.file,
        from: item.from,
        to: item.to,
        options,
      })
      const resultName = withExtension(item.file.name, item.to)
      updateItem(item.id, {
        status: 'done',
        progress: 1,
        resultBlob: blob,
        resultName,
        resultSize: blob.size,
        usedEngine: engine,
        fellBack,
        elapsed: performance.now() - start,
      })
    } catch (err) {
      updateItem(item.id, {
        status: 'error',
        progress: null,
        error: err?.message || 'Ошибка конвертации',
      })
    }
  }

  async function convertAll() {
    setBusy(true)
    // Snapshot the items that need converting.
    const queue = items.filter((it) => it.status !== 'done' && it.targets?.length)
    for (const it of queue) {
      // re-read latest target value from state
      const current = items.find((x) => x.id === it.id)
      await convertOne(current || it)
    }
    setBusy(false)
  }

  const pending = items.filter((it) => it.targets?.length && it.status !== 'done')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Конвертер файлов</h1>
        <p className="mt-1 text-sm text-slate-400">
          Изображения, документы, таблицы, аудио и видео. Где возможно — обработка прямо в браузере,
          без загрузки на сервер.
        </p>
      </div>

      <Dropzone
        onFiles={addFiles}
        hint="Поддерживаются изображения, PDF/DOCX/TXT/MD/HTML, XLSX/CSV, MP3/WAV, MP4/WEBM и другие"
      />

      {hasImages && (
        <ImageOptions options={imgOptions} onChange={setImgOptions} />
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-300">
              Файлы ({items.length})
            </h2>
            <div className="flex gap-2">
              <button
                className="btn-ghost"
                onClick={() => setItems([])}
                disabled={busy}
              >
                Очистить
              </button>
              <button
                className="btn-primary"
                onClick={convertAll}
                disabled={busy || pending.length === 0}
              >
                {busy ? <Loader2 className="animate-spin" size={16} /> : null}
                Конвертировать всё ({pending.length})
              </button>
            </div>
          </div>

          <ul className="space-y-2">
            {items.map((item) => (
              <FileRow
                key={item.id}
                item={item}
                onTargetChange={(to) => updateItem(item.id, { to })}
                onConvert={() => convertOne(item)}
                onRemove={() => removeItem(item.id)}
                onDownload={() => downloadBlob(item.resultBlob, item.resultName)}
                disabled={busy}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ImageOptions({ options, onChange }) {
  const set = (patch) => onChange({ ...options, ...patch })
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
        <Settings2 size={16} className="text-accent" /> Параметры изображений
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label">Разрешение</label>
          <select
            className="input"
            value={options.presetIdx}
            onChange={(e) => set({ presetIdx: Number(e.target.value), width: '', height: '' })}
          >
            {RESOLUTION_PRESETS.map((p, i) => (
              <option key={i} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ширина (px)</label>
          <input
            type="number"
            min="1"
            className="input"
            placeholder="авто"
            value={options.width}
            onChange={(e) => set({ width: e.target.value, presetIdx: 0 })}
          />
        </div>
        <div>
          <label className="label">Высота (px)</label>
          <input
            type="number"
            min="1"
            className="input"
            placeholder="авто"
            value={options.height}
            onChange={(e) => set({ height: e.target.value, presetIdx: 0 })}
          />
        </div>
        <div>
          <label className="label">Качество ({Math.round(options.quality * 100)}%)</label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            className="w-full accent-indigo-500"
            value={options.quality}
            onChange={(e) => set({ quality: e.target.value })}
          />
        </div>
      </div>
      <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          className="accent-indigo-500"
          checked={options.keepRatio}
          onChange={(e) => set({ keepRatio: e.target.checked })}
        />
        Сохранять пропорции
      </label>
    </div>
  )
}

function FileRow({ item, onTargetChange, onConvert, onRemove, onDownload, disabled }) {
  const engine = item.to ? engineFor(item.from, item.to) : null
  const badge = engine ? ENGINE_BADGE[engine] : null
  const BadgeIcon = badge?.icon

  return (
    <li className="card p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-200">{item.file.name}</p>
          <p className="text-xs text-slate-500">
            {CATEGORIES[item.category] || 'Неизвестно'} · {formatBytes(item.file.size)}
            {item.category && item.status === 'idle' && (
              <> · {estimateLabel(item.file.size, item.category)}</>
            )}
          </p>
        </div>

        {item.targets?.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">в</span>
            <select
              className="input w-28 py-1.5"
              value={item.to}
              onChange={(e) => onTargetChange(e.target.value)}
              disabled={disabled || item.status === 'running'}
            >
              {item.targets.map((t) => (
                <option key={t.to} value={t.to}>
                  {t.to.toUpperCase()}
                </option>
              ))}
            </select>
            {badge && (
              <span className={`hidden items-center gap-1 text-xs sm:inline-flex ${badge.cls}`}>
                {BadgeIcon && <BadgeIcon size={12} />} {badge.label}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {item.status === 'done' ? (
            <button className="btn-primary py-1.5" onClick={onDownload}>
              <Download size={15} /> Скачать
            </button>
          ) : (
            item.targets?.length > 0 && (
              <button
                className="btn-ghost py-1.5"
                onClick={onConvert}
                disabled={disabled || item.status === 'running'}
              >
                {item.status === 'running' ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  'Конвертировать'
                )}
              </button>
            )
          )}
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-ink-800 hover:text-slate-300"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Удалить"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {item.status === 'running' && (
        <div className="mt-3">
          <ProgressBar
            value={item.progress}
            label={item.progress == null ? 'Обработка…' : 'Конвертация'}
          />
        </div>
      )}

      {item.status === 'done' && (
        <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle2 size={14} />
          Готово · {formatBytes(item.resultSize)} · {formatDuration(item.elapsed)}
          {item.fellBack && (
            <span className="text-amber-400">· обработано на сервере (фолбэк)</span>
          )}
        </div>
      )}

      {item.status === 'error' && item.error && (
        <div className="mt-2 flex items-start gap-2 text-xs text-red-400">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {item.error}
        </div>
      )}
    </li>
  )
}
