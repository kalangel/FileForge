import { useState } from 'react'
import { QrCode, FolderArchive } from 'lucide-react'
import QrTool from '../components/tools/QrTool.jsx'
import ArchiveTool from '../components/tools/ArchiveTool.jsx'

const TABS = [
  { id: 'qr', label: 'QR-код', icon: QrCode, desc: 'Сгенерировать QR из текста или ссылки' },
  { id: 'zip', label: 'ZIP-архив', icon: FolderArchive, desc: 'Упаковать файлы или распаковать архив' },
]

const PANELS = { qr: QrTool, zip: ArchiveTool }

export default function Tools() {
  const [tab, setTab] = useState('qr')
  const Panel = PANELS[tab]
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          <span className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
            Инструменты
          </span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Небольшие утилиты для повседневных задач — всё работает прямо в браузере.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = t.id === tab
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'group flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                active
                  ? 'border-accent bg-accent/10'
                  : 'border-ink-700 bg-ink-900 hover:-translate-y-0.5 hover:border-ink-600',
              ].join(' ')}
            >
              <div className={['grid h-10 w-10 place-items-center rounded-lg', active ? 'bg-accent text-white' : 'bg-ink-800 text-slate-300'].join(' ')}>
                <Icon size={20} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-100">{t.label}</div>
                <div className="text-xs text-slate-500">{t.desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="card p-5">
        <Panel />
      </div>
    </div>
  )
}
