import { NavLink } from 'react-router-dom'
import { FileStack, RefreshCw, ShieldCheck } from 'lucide-react'

const tabClass = ({ isActive }) =>
  [
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-accent text-white' : 'text-slate-300 hover:bg-ink-800',
  ].join(' ')

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white">
            <FileStack size={18} />
          </div>
          <span className="text-lg font-semibold tracking-tight">FileForge</span>
        </div>

        <nav className="flex items-center gap-1">
          <NavLink to="/convert" className={tabClass}>
            <RefreshCw size={16} /> Конвертер
          </NavLink>
          <NavLink to="/pdf" className={tabClass}>
            <FileStack size={16} /> PDF-редактор
          </NavLink>
        </nav>

        <div className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
          <ShieldCheck size={14} className="text-emerald-400" />
          Приватно
        </div>
      </div>
    </header>
  )
}
