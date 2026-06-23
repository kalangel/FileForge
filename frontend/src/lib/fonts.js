// Font registry for the PDF editor.
//
// Three kinds of fonts:
//   * standard   — pdf-lib's built-in 14 (Helvetica/Times/Courier). No embedding.
//   * bundled    — real TTFs (via @expo-google-fonts) embedded with fontkit.
//   * custom     — user-uploaded TTF/OTF, embedded as-is.
//
// For on-screen display we inject @font-face rules lazily; for the saved PDF we
// fetch the TTF bytes and embed them with pdf-lib + fontkit.

import { StandardFonts } from 'pdf-lib'

// ---- bundled font files (Vite turns these into hashed asset URLs) ----
// Only the four styles we use, so the build doesn't pull in every weight.
const U = import.meta.glob(
  [
    '/node_modules/@expo-google-fonts/**/400Regular/*.ttf',
    '/node_modules/@expo-google-fonts/**/400Regular_Italic/*.ttf',
    '/node_modules/@expo-google-fonts/**/700Bold/*.ttf',
    '/node_modules/@expo-google-fonts/**/700Bold_Italic/*.ttf',
  ],
  { query: '?url', import: 'default', eager: true },
)

// Resolve a bundled url by package + style suffix.
function url(pkg, name, suffix) {
  const key = `/node_modules/@expo-google-fonts/${pkg}/${suffix}/${name}_${suffix}.ttf`
  return U[key]
}
function family(pkg, name) {
  return {
    r: url(pkg, name, '400Regular'),
    i: url(pkg, name, '400Regular_Italic'),
    b: url(pkg, name, '700Bold'),
    bi: url(pkg, name, '700Bold_Italic'),
  }
}

// id -> { label, group, kind, css, files?, std?, note? }
const BUNDLED = {
  Arial: { label: 'Arial', group: 'Без засечек', files: family('arimo', 'Arimo') },
  Aptos: { label: 'Aptos *', group: 'Без засечек', files: family('inter', 'Inter'), note: 'Открытый аналог Aptos (Inter). Для точного Aptos загрузите свой файл.' },
  Roboto: { label: 'Roboto', group: 'Без засечек', files: family('roboto', 'Roboto') },
  'Open Sans': { label: 'Open Sans', group: 'Без засечек', files: family('open-sans', 'OpenSans') },
  Lato: { label: 'Lato', group: 'Без засечек', files: family('lato', 'Lato') },
  Montserrat: { label: 'Montserrat', group: 'Без засечек', files: family('montserrat', 'Montserrat') },
  Poppins: { label: 'Poppins', group: 'Без засечек', files: family('poppins', 'Poppins') },
  Merriweather: { label: 'Merriweather', group: 'С засечками', files: family('merriweather', 'Merriweather') },
  Tinos: { label: 'Tinos (Times-совместимый)', group: 'С засечками', files: family('tinos', 'Tinos') },
  'Source Code Pro': { label: 'Source Code Pro', group: 'Моноширинные', files: family('source-code-pro', 'SourceCodePro') },
}

const STANDARD = {
  Helvetica: { label: 'Helvetica', group: 'Стандартные', css: 'Helvetica, Arial, sans-serif' },
  Times: { label: 'Times', group: 'Стандартные', css: '"Times New Roman", Times, serif' },
  Courier: { label: 'Courier', group: 'Стандартные', css: '"Courier New", Courier, monospace' },
}

// Runtime store for user-uploaded fonts: id -> { label, bytes:Uint8Array, cssName }
const customFonts = new Map()

const FONT_BYTE_CACHE = new Map() // `${id}-${style}` -> Promise<Uint8Array>
const injected = new Set()

function styleKey(bold, italic) {
  return bold && italic ? 'bi' : bold ? 'b' : italic ? 'i' : 'r'
}

/** Grouped list for the picker. */
export function fontGroups() {
  const groups = {}
  const push = (id, def) => {
    ;(groups[def.group] ||= []).push({ id, label: def.label, note: def.note })
  }
  for (const [id, def] of Object.entries(STANDARD)) push(id, def)
  for (const [id, def] of Object.entries(BUNDLED)) push(id, def)
  for (const [id, def] of customFonts) push(id, { label: def.label, group: 'Загруженные' })
  return Object.entries(groups).map(([group, fonts]) => ({ group, fonts }))
}

export function isStandard(id) {
  return Boolean(STANDARD[id])
}

export function standardFontName(id, bold, italic) {
  const map = {
    Helvetica: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
    Times: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
    Courier: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
  }
  const set = map[id] || map.Helvetica
  return set[(bold ? 1 : 0) + (italic ? 2 : 0)]
}

/** CSS font-family for on-screen rendering; also injects @font-face if needed. */
export function cssFamilyFor(id, bold, italic) {
  if (STANDARD[id]) return STANDARD[id].css
  if (customFonts.has(id)) {
    ensureFace(id)
    return `"${customFonts.get(id).cssName}"`
  }
  if (BUNDLED[id]) {
    ensureFace(id)
    return `"FF_${cssSafe(id)}"`
  }
  return STANDARD.Helvetica.css
}

function cssSafe(id) {
  return id.replace(/[^a-z0-9]/gi, '')
}

function ensureFace(id) {
  if (injected.has(id)) return
  injected.add(id)
  const style = document.createElement('style')
  if (customFonts.has(id)) {
    const c = customFonts.get(id)
    style.textContent = `@font-face{font-family:"${c.cssName}";src:url(${c.objectUrl});}`
  } else {
    const f = BUNDLED[id].files
    const name = `FF_${cssSafe(id)}`
    const face = (src, weight, st) =>
      src ? `@font-face{font-family:"${name}";font-weight:${weight};font-style:${st};src:url(${src}) format("truetype");}` : ''
    style.textContent = [
      face(f.r, 'normal', 'normal'),
      face(f.i, 'normal', 'italic'),
      face(f.b, 'bold', 'normal'),
      face(f.bi, 'bold', 'italic'),
    ].join('')
  }
  document.head.appendChild(style)
}

/** Register a user-uploaded font file. Returns its generated id. */
export async function registerCustomFont(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const id = `custom:${file.name}`
  const cssName = `FFUser_${cssSafe(id)}_${Math.random().toString(36).slice(2, 6)}`
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'font/ttf' }))
  customFonts.set(id, {
    label: file.name.replace(/\.(ttf|otf)$/i, ''),
    bytes,
    cssName,
    objectUrl,
  })
  injected.delete(id)
  ensureFace(id)
  return id
}

/** TTF/OTF bytes for embedding (null for standard fonts). */
export async function embedBytes(id, bold, italic) {
  if (STANDARD[id]) return null
  if (customFonts.has(id)) return customFonts.get(id).bytes
  const def = BUNDLED[id]
  if (!def) return null
  const key = `${id}-${styleKey(bold, italic)}`
  if (!FONT_BYTE_CACHE.has(key)) {
    const src = def.files[styleKey(bold, italic)] || def.files.r
    FONT_BYTE_CACHE.set(
      key,
      fetch(src).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b)),
    )
  }
  return FONT_BYTE_CACHE.get(key)
}
