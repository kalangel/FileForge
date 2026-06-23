import { useState } from 'react'
import {
  Layers,
  Combine,
  Scissors,
  Stamp,
  Minimize2,
  FileText,
  Images,
  Lock,
} from 'lucide-react'
import PagesTool from '../components/pdf/PagesTool.jsx'
import MergeTool from '../components/pdf/MergeTool.jsx'
import SplitTool from '../components/pdf/SplitTool.jsx'
import StampTool from '../components/pdf/StampTool.jsx'
import CompressTool from '../components/pdf/CompressTool.jsx'
import ExtractTool from '../components/pdf/ExtractTool.jsx'
import ConvertTool from '../components/pdf/ConvertTool.jsx'
import PasswordTool from '../components/pdf/PasswordTool.jsx'

const TOOLS = [
  { id: 'pages', label: 'Страницы', icon: Layers, desc: 'Просмотр, поворот, удаление, перестановка' },
  { id: 'merge', label: 'Объединить', icon: Combine, desc: 'Несколько PDF в один' },
  { id: 'split', label: 'Разделить', icon: Scissors, desc: 'По диапазонам или по страницам' },
  { id: 'stamp', label: 'Текст и водяной знак', icon: Stamp, desc: 'Текст, подпись, водяной знак' },
  { id: 'compress', label: 'Сжать', icon: Minimize2, desc: 'Уменьшить размер файла' },
  { id: 'extract', label: 'Извлечь текст', icon: FileText, desc: 'Текст из PDF' },
  { id: 'convert', label: 'PDF ↔ Изображения', icon: Images, desc: 'Страницы в картинки и обратно' },
  { id: 'password', label: 'Пароль', icon: Lock, desc: 'Установить или снять пароль' },
]

const PANELS = {
  pages: PagesTool,
  merge: MergeTool,
  split: SplitTool,
  stamp: StampTool,
  compress: CompressTool,
  extract: ExtractTool,
  convert: ConvertTool,
  password: PasswordTool,
}

export default function PdfEditor() {
  const [tool, setTool] = useState('pages')
  const Panel = PANELS[tool]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">PDF-редактор</h1>
        <p className="mt-1 text-sm text-slate-400">
          Все операции выполняются прямо в браузере (кроме работы с паролем — она требует сервера).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav className="card h-fit overflow-hidden">
          {TOOLS.map((t) => {
            const Icon = t.icon
            const active = t.id === tool
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={[
                  'flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors',
                  active
                    ? 'border-accent bg-ink-850'
                    : 'border-transparent hover:bg-ink-850/60',
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
        </nav>

        <section className="min-w-0">
          <Panel />
        </section>
      </div>
    </div>
  )
}
