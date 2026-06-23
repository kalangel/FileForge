import { useCallback, useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'

/**
 * Drag-and-drop + click-to-select file input.
 * Props: onFiles(File[]), accept (string), multiple (bool), hint (string).
 */
export default function Dropzone({ onFiles, accept, multiple = true, hint }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFiles = useCallback(
    (list) => {
      const files = Array.from(list || [])
      if (files.length) onFiles(files)
    },
    [onFiles],
  )

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={[
        'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
        dragging
          ? 'border-accent bg-accent/10'
          : 'border-ink-700 bg-ink-900 hover:border-ink-600 hover:bg-ink-850',
      ].join(' ')}
    >
      <UploadCloud className={dragging ? 'text-accent' : 'text-slate-400'} size={40} />
      <p className="mt-3 text-sm font-medium text-slate-200">
        Перетащите файлы сюда или нажмите для выбора
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = '' // allow re-selecting the same file
        }}
      />
    </div>
  )
}
