import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MousePointer2,
  Type,
  ImagePlus,
  PenLine,
  Trash2,
  RotateCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
} from 'lucide-react'
import Dropzone from '../Dropzone.jsx'
import { useDirtyFile } from './DirtyContext.js'
import { loadPdf, renderPageToCanvas, renderPageToDataUrl } from '../../lib/pdfRender.js'
import { applyEdits } from '../../lib/pdfTools.js'
import { downloadBlob, formatBytes, uid } from '../../lib/utils.js'

// ---- colour helpers (hex <-> 0..1 rgb) ----
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255)
}
const rgbToCss = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`

const MAX_W = 820 // max on-screen page width in px

export default function EditorTool() {
  const [file, setFile] = useState(null)
  const [pdf, setPdf] = useState(null)
  const [thumbs, setThumbs] = useState({}) // origIndex -> dataUrl
  const [pageOrder, setPageOrder] = useState([]) // [{ origIndex, rotate }]
  const [ci, setCi] = useState(0) // current index into pageOrder
  const [bg, setBg] = useState(null) // { url, w, h } of current page render
  const [scale, setScale] = useState(1)
  const [annById, setAnnById] = useState({}) // origIndex -> annotation[]
  const [mode, setMode] = useState('select') // select | text | draw
  const [color, setColor] = useState('#2563eb')
  const [textSize, setTextSize] = useState(18)
  const [penSize, setPenSize] = useState(3)
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [stroke, setStroke] = useState(null) // in-progress freehand [{x,y}] in px
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const stageRef = useRef(null)
  const dragRef = useRef(null)
  const fileInputRef = useRef(null)

  useDirtyFile(Boolean(file))

  const current = pageOrder[ci]
  const origIndex = current?.origIndex
  const anns = useMemo(() => (origIndex != null ? annById[origIndex] || [] : []), [annById, origIndex])
  const pageHeightPt = bg ? bg.h / scale : 0

  // ---- load a PDF ----
  async function loadFile(files) {
    const f = files[0]
    setError(null)
    try {
      const doc = await loadPdf(f)
      const order = []
      const th = {}
      for (let i = 0; i < doc.numPages; i++) {
        order.push({ origIndex: i, rotate: 0 })
        th[i] = await renderPageToDataUrl(doc, i + 1, 0.22)
      }
      setFile(f)
      setPdf(doc)
      setThumbs(th)
      setPageOrder(order)
      setAnnById({})
      setCi(0)
      setSelectedId(null)
    } catch (e) {
      setError('Не удалось открыть PDF: ' + (e?.message || ''))
    }
  }

  // ---- render the current page whenever it changes ----
  const renderPage = useCallback(async () => {
    if (!pdf || !current) return
    const containerW = stageRef.current?.parentElement?.clientWidth || MAX_W
    const page = await pdf.getPage(current.origIndex + 1)
    const base = page.getViewport({ scale: 1, rotation: 0 })
    const s = Math.min(MAX_W, containerW) / base.width
    const canvas = await renderPageToCanvas(pdf, current.origIndex + 1, s, 0)
    setScale(s)
    setBg({ url: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height })
  }, [pdf, current])

  useEffect(() => {
    renderPage()
  }, [renderPage])

  // ---- annotation helpers ----
  const updateAnns = (origIdx, fn) =>
    setAnnById((prev) => ({ ...prev, [origIdx]: fn(prev[origIdx] || []) }))

  const addAnn = (a) => updateAnns(origIndex, (list) => [...list, a])
  const patchAnn = (id, patch) =>
    updateAnns(origIndex, (list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const removeAnn = (id) => updateAnns(origIndex, (list) => list.filter((a) => a.id !== id))

  const pxToPt = (v) => v / scale
  const ptToPx = (v) => v * scale

  // ---- stage interactions (add text / draw) ----
  function stagePoint(e) {
    const r = stageRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function onStageClick(e) {
    if (mode === 'text') {
      const p = stagePoint(e)
      const id = uid()
      addAnn({
        id,
        type: 'text',
        x: pxToPt(p.x),
        y: pxToPt(p.y),
        text: 'Текст',
        size: textSize,
        color: hexToRgb(color),
      })
      setMode('select')
      setSelectedId(id)
      setEditingId(id)
    } else if (mode === 'select') {
      setSelectedId(null)
    }
  }

  function onStagePointerDown(e) {
    if (mode !== 'draw') return
    e.currentTarget.setPointerCapture(e.pointerId)
    setStroke([stagePoint(e)])
  }
  function onStagePointerMove(e) {
    if (mode !== 'draw' || !stroke) return
    setStroke((s) => [...s, stagePoint(e)])
  }
  function onStagePointerUp() {
    if (mode !== 'draw' || !stroke) return
    if (stroke.length > 1) {
      addAnn({
        id: uid(),
        type: 'draw',
        color: hexToRgb(color),
        size: penSize,
        points: stroke.map((p) => [pxToPt(p.x), pxToPt(p.y)]),
      })
    }
    setStroke(null)
  }

  // ---- dragging existing annotations ----
  function startDrag(e, a) {
    if (mode !== 'select' || editingId === a.id) return
    e.stopPropagation()
    setSelectedId(a.id)
    const p = stagePoint(e)
    dragRef.current = { id: a.id, dx: p.x - ptToPx(a.x), dy: p.y - ptToPx(a.y) }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onDragMove(e) {
    const d = dragRef.current
    if (!d || d.resize) return
    const p = stagePoint(e)
    patchAnn(d.id, { x: pxToPt(p.x - d.dx), y: pxToPt(p.y - d.dy) })
  }
  function endDrag() {
    dragRef.current = null
  }

  // image resize handle
  function startResize(e, a) {
    e.stopPropagation()
    setSelectedId(a.id)
    const p = stagePoint(e)
    dragRef.current = { id: a.id, resize: true, sx: p.x, sy: p.y, w0: a.w, h0: a.h }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onResizeMove(e) {
    const d = dragRef.current
    if (!d || !d.resize) return
    const p = stagePoint(e)
    const ratio = d.h0 / d.w0
    const newW = Math.max(20, d.w0 + pxToPt(p.x - d.sx))
    patchAnn(d.id, { w: newW, h: newW * ratio })
  }

  // ---- add image / signature image ----
  async function onPickImage(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const { bytes, imgType, w, h, dataUrl } = await readImage(f)
      const targetW = (pageHeightPt ? bg.w / scale : 200) * 0.4
      const ratio = h / w
      addAnn({
        id: uid(),
        type: 'image',
        x: 40,
        y: 40,
        w: targetW,
        h: targetW * ratio,
        bytes,
        imgType,
        dataUrl,
      })
      setMode('select')
    } catch (err) {
      setError('Не удалось добавить изображение: ' + (err?.message || ''))
    }
  }

  // ---- keyboard: delete selected ----
  useEffect(() => {
    function onKey(e) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && editingId !== selectedId) {
        const tag = document.activeElement?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        removeAnn(selectedId)
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, editingId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- page operations ----
  const rotatePage = (deg) =>
    setPageOrder((o) => o.map((p, i) => (i === ci ? { ...p, rotate: (p.rotate + deg + 360) % 360 } : p)))
  const movePage = (dir) =>
    setPageOrder((o) => {
      const j = ci + dir
      if (j < 0 || j >= o.length) return o
      const c = [...o]
      ;[c[ci], c[j]] = [c[j], c[ci]]
      setCi(j)
      return c
    })
  const deletePage = () => {
    if (pageOrder.length <= 1) return
    setPageOrder((o) => o.filter((_, i) => i !== ci))
    setCi((c) => Math.max(0, c - (c === pageOrder.length - 1 ? 1 : 0)))
    setSelectedId(null)
  }

  // ---- save ----
  async function save() {
    setSaving(true)
    setError(null)
    try {
      const blob = await applyEdits(file, pageOrder, annById)
      downloadBlob(blob, file.name.replace(/\.pdf$/i, '_edited.pdf'))
    } catch (e) {
      setError('Ошибка при сохранении: ' + (e?.message || ''))
    } finally {
      setSaving(false)
    }
  }

  if (!file) {
    return (
      <Dropzone
        onFiles={loadFile}
        accept="application/pdf,.pdf"
        multiple={false}
        hint="Откройте PDF, чтобы добавить текст, изображения и подпись"
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="card flex flex-wrap items-center gap-2 p-2">
        <ToolBtn active={mode === 'select'} onClick={() => setMode('select')} icon={MousePointer2} label="Курсор" />
        <ToolBtn active={mode === 'text'} onClick={() => setMode('text')} icon={Type} label="Текст" />
        <ToolBtn active={false} onClick={() => fileInputRef.current?.click()} icon={ImagePlus} label="Изображение" />
        <ToolBtn active={mode === 'draw'} onClick={() => setMode('draw')} icon={PenLine} label="Подпись" />

        <div className="mx-1 h-6 w-px bg-ink-700" />

        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          Цвет
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-7 w-7 cursor-pointer rounded border border-ink-700 bg-transparent"
          />
        </label>
        {mode === 'text' || (selectedId && anns.find((a) => a.id === selectedId)?.type === 'text') ? (
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Размер
            <input
              type="number" min="6" max="96"
              value={textSize}
              onChange={(e) => {
                const v = Number(e.target.value)
                setTextSize(v)
                if (selectedId) patchAnn(selectedId, { size: v })
              }}
              className="input w-16 py-1"
            />
          </label>
        ) : (
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Толщина
            <input type="range" min="1" max="10" value={penSize} onChange={(e) => setPenSize(Number(e.target.value))} className="accent-indigo-500" />
          </label>
        )}

        {selectedId && (
          <button className="btn-danger ml-auto py-1.5" onClick={() => { removeAnn(selectedId); setSelectedId(null) }}>
            <Trash2 size={15} /> Удалить объект
          </button>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
        <span>{file.name} · {formatBytes(file.size)} · {pageOrder.length} стр.</span>
        <div className="flex gap-2">
          <button className="btn-ghost py-1.5" onClick={() => { setFile(null); setPdf(null) }}>Другой файл</button>
          <button className="btn-primary py-1.5" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />} Сохранить PDF
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-4 md:grid-cols-[1fr_120px]">
        {/* Page + overlay */}
        <div className="overflow-auto rounded-xl border border-ink-700 bg-ink-950 p-4">
          {bg && (
            <div
              ref={stageRef}
              onClick={onStageClick}
              onPointerDown={onStagePointerDown}
              onPointerMove={(e) => { onStagePointerMove(e); onDragMove(e); onResizeMove(e) }}
              onPointerUp={(e) => { onStagePointerUp(); endDrag(e) }}
              className="relative mx-auto select-none shadow-lg"
              style={{
                width: bg.w,
                height: bg.h,
                cursor: mode === 'text' ? 'text' : mode === 'draw' ? 'crosshair' : 'default',
              }}
            >
              <img src={bg.url} alt="page" className="pointer-events-none absolute inset-0 h-full w-full" draggable={false} />

              {/* existing strokes + in-progress */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {anns.filter((a) => a.type === 'draw').map((a) => (
                  <polyline
                    key={a.id}
                    points={a.points.map(([x, y]) => `${ptToPx(x)},${ptToPx(y)}`).join(' ')}
                    fill="none"
                    stroke={rgbToCss(a.color)}
                    strokeWidth={ptToPx(a.size)}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className={selectedId === a.id ? 'opacity-80' : ''}
                    onClick={(e) => { e.stopPropagation(); if (mode === 'select') setSelectedId(a.id) }}
                    style={{ pointerEvents: mode === 'select' ? 'stroke' : 'none' }}
                  />
                ))}
                {stroke && (
                  <polyline
                    points={stroke.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none" stroke={color} strokeWidth={ptToPx(penSize)} strokeLinejoin="round" strokeLinecap="round"
                  />
                )}
              </svg>

              {/* text + image annotations */}
              {anns.filter((a) => a.type !== 'draw').map((a) =>
                a.type === 'text' ? (
                  <div
                    key={a.id}
                    onPointerDown={(e) => startDrag(e, a)}
                    onClick={(e) => { e.stopPropagation(); if (mode === 'select') setSelectedId(a.id) }}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingId(a.id); setSelectedId(a.id) }}
                    contentEditable={editingId === a.id}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const t = e.currentTarget.textContent
                      setEditingId(null)
                      if (!t.trim()) removeAnn(a.id)
                      else patchAnn(a.id, { text: t })
                    }}
                    ref={editingId === a.id ? (el) => el && focusEnd(el) : undefined}
                    className={[
                      'absolute whitespace-pre leading-tight outline-none',
                      mode === 'select' ? 'cursor-move' : 'pointer-events-none',
                      selectedId === a.id ? 'ring-1 ring-accent ring-offset-1 ring-offset-transparent' : '',
                    ].join(' ')}
                    style={{
                      left: ptToPx(a.x),
                      top: ptToPx(a.y),
                      fontSize: ptToPx(a.size),
                      color: rgbToCss(a.color),
                      fontFamily: 'Helvetica, Arial, sans-serif',
                    }}
                  >
                    {a.text}
                  </div>
                ) : (
                  <div
                    key={a.id}
                    onPointerDown={(e) => startDrag(e, a)}
                    onClick={(e) => { e.stopPropagation(); if (mode === 'select') setSelectedId(a.id) }}
                    className={[
                      'absolute',
                      mode === 'select' ? 'cursor-move' : 'pointer-events-none',
                      selectedId === a.id ? 'ring-1 ring-accent' : '',
                    ].join(' ')}
                    style={{ left: ptToPx(a.x), top: ptToPx(a.y), width: ptToPx(a.w), height: ptToPx(a.h) }}
                  >
                    <img src={a.dataUrl} alt="" className="h-full w-full" draggable={false} />
                    {selectedId === a.id && mode === 'select' && (
                      <span
                        onPointerDown={(e) => startResize(e, a)}
                        className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-white bg-accent"
                      />
                    )}
                  </div>
                ),
              )}
            </div>
          )}

          {/* page nav */}
          <div className="mx-auto mt-4 flex items-center justify-center gap-3 text-sm text-slate-300">
            <button className="btn-ghost py-1.5" onClick={() => setCi((c) => Math.max(0, c - 1))} disabled={ci === 0}>
              <ChevronLeft size={16} />
            </button>
            <span>{ci + 1} / {pageOrder.length}{current?.rotate ? ` · ↻${current.rotate}°` : ''}</span>
            <button className="btn-ghost py-1.5" onClick={() => setCi((c) => Math.min(pageOrder.length - 1, c + 1))} disabled={ci === pageOrder.length - 1}>
              <ChevronRight size={16} />
            </button>
            <div className="mx-2 h-6 w-px bg-ink-700" />
            <button className="btn-ghost py-1.5" title="Повернуть влево" onClick={() => rotatePage(-90)}><RotateCcw size={15} /></button>
            <button className="btn-ghost py-1.5" title="Повернуть вправо" onClick={() => rotatePage(90)}><RotateCw size={15} /></button>
            <button className="btn-ghost py-1.5" title="Сдвинуть страницу влево" onClick={() => movePage(-1)} disabled={ci === 0}><ChevronLeft size={15} /></button>
            <button className="btn-ghost py-1.5" title="Сдвинуть страницу вправо" onClick={() => movePage(1)} disabled={ci === pageOrder.length - 1}><ChevronRight size={15} /></button>
            <button className="btn-danger py-1.5" title="Удалить страницу" onClick={deletePage} disabled={pageOrder.length <= 1}><Trash2 size={15} /></button>
          </div>
        </div>

        {/* thumbnail rail */}
        <div className="hidden max-h-[70vh] space-y-2 overflow-auto md:block">
          {pageOrder.map((p, i) => (
            <button
              key={`${p.origIndex}-${i}`}
              onClick={() => { setCi(i); setSelectedId(null) }}
              className={[
                'block w-full overflow-hidden rounded-lg border bg-ink-950 p-1 transition-colors',
                i === ci ? 'border-accent' : 'border-ink-700 hover:border-ink-600',
              ].join(' ')}
            >
              <img
                src={thumbs[p.origIndex]}
                alt={`p${i + 1}`}
                className="mx-auto"
                style={{ transform: `rotate(${p.rotate}deg)` }}
              />
              <span className="mt-1 block text-center text-[10px] text-slate-500">{i + 1}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Подсказка: «Текст» — кликните по странице и печатайте (двойной клик — редактировать).
        «Подпись» — рисуйте мышью. В режиме «Курсор» объекты можно перетаскивать; Delete — удалить выбранный.
      </p>
    </div>
  )
}

function ToolBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
        active ? 'bg-accent text-white' : 'bg-ink-800 text-slate-200 hover:bg-ink-700',
      ].join(' ')}
    >
      <Icon size={15} /> {label}
    </button>
  )
}

function focusEnd(el) {
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}

// Read an image file into { bytes, imgType:'png'|'jpg', w, h, dataUrl }.
// Non-PNG/JPG are rasterised to PNG so pdf-lib can embed them.
async function readImage(file) {
  const isJpg = /jpe?g$/i.test(file.type) || /\.jpe?g$/i.test(file.name)
  const isPng = /png$/i.test(file.type) || /\.png$/i.test(file.name)
  const dataUrl = await new Promise((res) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.readAsDataURL(file)
  })
  const img = await new Promise((res, rej) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = rej
    im.src = dataUrl
  })

  if (isPng || isJpg) {
    return {
      bytes: new Uint8Array(await file.arrayBuffer()),
      imgType: isPng ? 'png' : 'jpg',
      w: img.naturalWidth,
      h: img.naturalHeight,
      dataUrl,
    }
  }
  // Rasterise others (webp/bmp/...) to PNG.
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d').drawImage(img, 0, 0)
  const pngUrl = canvas.toDataURL('image/png')
  const blob = await (await fetch(pngUrl)).blob()
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    imgType: 'png',
    w: canvas.width,
    h: canvas.height,
    dataUrl: pngUrl,
  }
}
