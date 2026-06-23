import { NavLink } from 'react-router-dom'
import { FileStack, RefreshCw, Wrench, ShieldCheck, PenSquare } from 'lucide-react'

const tabClass = ({ isActive }) =>
  [
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-300 hover:bg-ink-800',
  ].join(' ')

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30">
            <FileStack size={18} />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            File<span className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">Forge</span>
          </span>
        </div>

        <nav className="flex items-center gap-1">
          <NavLink to="/convert" className={tabClass}>
            <RefreshCw size={16} /> <span className="hidden sm:inline">Конвертер</span>
          </NavLink>
          <NavLink to="/pdf" className={tabClass}>
            <PenSquare size={16} /> <span className="hidden sm:inline">PDF-редактор</span>
          </NavLink>
          <NavLink to="/tools" className={tabClass}>
            <Wrench size={16} /> <span className="hidden sm:inline">Инструменты</span>
          </NavLink>
        </nav>

        <div className="hidden items-center gap-1.5 text-xs text-slate-400 lg:flex">
          <ShieldCheck size={14} className="text-emerald-400" />
          Приватно
        </div>
      </div>
    </header>
  )
}
