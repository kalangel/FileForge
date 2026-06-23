import { useState } from 'react'
import {
  PenSquare,
  Combine,
  Scissors,
  Minimize2,
  FileText,
  Images,
  AlertTriangle,
} from 'lucide-react'
import { DirtyContext } from '../components/pdf/DirtyContext.js'
import EditorTool from '../components/pdf/EditorTool.jsx'
import MergeTool from '../components/pdf/MergeTool.jsx'
import SplitTool from '../components/pdf/SplitTool.jsx'
import CompressTool from '../components/pdf/CompressTool.jsx'
import ExtractTool from '../components/pdf/ExtractTool.jsx'
import ConvertTool from '../components/pdf/ConvertTool.jsx'

// Grouped so the headline (the real editor) is clearly separate from
// file-level operations and conversions.
const GROUPS = [
  {
    title: 'Редактирование',
    tools: [
      { id: 'editor', label: 'Редактор PDF', icon: PenSquare, desc: 'Текст, изображения, подпись, страницы' },
    ],
  },
  {
    title: 'Операции с файлом',
    tools: [
      { id: 'merge', label: 'Объединить', icon: Combine, desc: 'Несколько PDF в один' },
      { id: 'split', label: 'Разделить', icon: Scissors, desc: 'По диапазонам или страницам' },
      { id: 'compress', label: 'Сжать', icon: Minimize2, desc: 'Уменьшить размер' },
    ],
  },
  {
    title: 'Конвертация',
    tools: [
      { id: 'convert', label: 'PDF ↔ Изображения', icon: Images, desc: 'Страницы в картинки и обратно' },
      { id: 'extract', label: 'Извлечь текст', icon: FileText, desc: 'Текстовый слой PDF' },
    ],
  },
]

const PANELS = {
  editor: EditorTool,
  merge: MergeTool,
  split: SplitTool,
  compress: CompressTool,
  extract: ExtractTool,
  convert: ConvertTool,
}

export default function PdfEditor() {
  const [tool, setTool] = useState('editor')
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(null) // tool id awaiting confirmation
  const Panel = PANELS[tool]

  function selectTool(id) {
    if (id === tool) return
    if (dirty) setPending(id)
    else setTool(id)
  }

  function confirmSwitch() {
    setDirty(false)
    setTool(pending)
    setPending(null)
  }

  return (
    <DirtyContext.Provider value={setDirty}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">
            <span className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
              PDF-редактор
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Редактируйте PDF прямо в браузере: добавляйте текст, изображения и подпись, меняйте
            страницы. Файл не покидает устройство (кроме операций с паролем).
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <nav className="space-y-4">
            {GROUPS.map((group) => (
              <div key={group.title} className="card overflow-hidden">
                <div className="border-b border-ink-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group.title}
                </div>
                {group.tools.map((t) => {
                  const Icon = t.icon
                  const active = t.id === tool
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectTool(t.id)}
                      className={[
                        'flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors',
                        active ? 'border-accent bg-ink-850' : 'border-transparent hover:bg-ink-850/60',
                      ].join(' ')}
                    >
                      <Icon size={18} className={active ? 'text-accent' : 'text-slate-400'} />
                      <span>
                        <span className="block text-sm font-medium text-slate-200">{t.label}</span>
                        <span className="block text-xs text-slate-500">{t.desc}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>

          <section className="min-w-0">
            <Panel />
          </section>
        </div>
      </div>

      {pending && (
        <ConfirmModal
          onCancel={() => setPending(null)}
          onConfirm={confirmSwitch}
        />
      )}
    </DirtyContext.Provider>
  )
}

function ConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className="card max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2 text-amber-400">
          <AlertTriangle size={20} />
          <h3 className="text-base font-semibold text-slate-100">Несохранённые изменения</h3>
        </div>
        <p className="text-sm text-slate-400">
          У вас открыт файл с изменениями. При переходе в другой раздел данные не сохранятся.
          Сначала нажмите «Сохранить PDF», если хотите оставить результат.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>Остаться</button>
          <button className="btn-danger" onClick={onConfirm}>Выйти без сохранения</button>
        </div>
      </div>
    </div>
  )
}
