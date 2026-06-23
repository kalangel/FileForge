import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Converter from './pages/Converter.jsx'
import PdfEditor from './pages/PdfEditor.jsx'

export default function App() {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/convert" replace />} />
          <Route path="/convert" element={<Converter />} />
          <Route path="/pdf" element={<PdfEditor />} />
          <Route path="*" element={<Navigate to="/convert" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-ink-800 px-4 py-4 text-center text-xs text-slate-500">
        FileForge — обработка файлов прямо в браузере. Ваши файлы не покидают устройство, если не указано иное.
      </footer>
    </div>
  )
}
