// Dispatches a conversion job to the correct engine based on the
// conversion table in formats.js. Falls back to the server when a
// client-side engine fails or isn't available.

import { getTargets, normalizeExt, getCategory } from './formats.js'
import { convertImage } from './imageConverter.js'
import { convertDocument, convertSpreadsheet } from './docConverter.js'
import { convertMedia } from './mediaConverter.js'
import { serverConvert } from './serverClient.js'

/** Find the declared engine for a from->to pair. */
export function engineFor(fromExt, to) {
  const from = normalizeExt(fromExt)
  const target = getTargets(from).find((t) => t.to === normalizeExt(to))
  return target?.engine || null
}

/**
 * Run a conversion.
 * job: { file, from, to, options }
 * options may include image sizing/quality and an onProgress(0..1) callback.
 * Returns { blob, engine }.
 */
export async function runConversion(job) {
  const { file, to, options = {} } = job
  const from = normalizeExt(job.from)
  const engine = engineFor(from, to)

  if (!engine) {
    throw new Error(`Конвертация ${from.toUpperCase()} → ${to.toUpperCase()} не поддерживается`)
  }

  try {
    let blob
    switch (engine) {
      case 'canvas':
        blob = await convertImage(file, { ...options, to })
        break
      case 'doc':
      case 'pdf':
        blob = await convertDocument(file, to, from)
        break
      case 'sheet':
        blob = await convertSpreadsheet(file, to, from)
        break
      case 'ffmpeg':
        blob = await convertMedia(file, to, from, options)
        break
      case 'server':
        blob = await serverConvert(file, to, from)
        return { blob, engine: 'server' }
      default:
        throw new Error(`Неизвестный движок: ${engine}`)
    }
    return { blob, engine }
  } catch (err) {
    // Graceful fallback: if a client engine fails and a server is configured,
    // try the backend before giving up.
    if (engine !== 'server') {
      try {
        const blob = await serverConvert(file, to, from)
        return { blob, engine: 'server', fellBack: true }
      } catch {
        /* keep the original, more descriptive client error */
      }
    }
    throw err
  }
}

/** Whether a conversion runs without ever touching the network. */
export function isClientSide(fromExt, to) {
  const e = engineFor(fromExt, to)
  return e && e !== 'server'
}

export { getCategory }
