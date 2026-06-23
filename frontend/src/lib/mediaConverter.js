// Audio/video conversion via ffmpeg.wasm (runs entirely in the browser).
// The wasm core is ~30 MB and loads lazily on first use.

import { normalizeExt } from './formats.js'

let ffmpegInstance = null
let loadingPromise = null

const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

/** Lazily create and load the shared ffmpeg instance. */
export async function getFfmpeg(onProgress) {
  if (ffmpegInstance) return ffmpegInstance
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { toBlobURL } = await import('@ffmpeg/util')
    const ffmpeg = new FFmpeg()
    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => onProgress(Math.min(1, progress)))
    }
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    ffmpegInstance = ffmpeg
    return ffmpeg
  })()

  return loadingPromise
}

/** Build ffmpeg args for a given target format. */
function argsFor(input, output, to, opts = {}) {
  const a = ['-i', input]
  switch (to) {
    case 'mp3':
      a.push('-vn', '-b:a', opts.audioBitrate || '192k')
      break
    case 'wav':
      a.push('-vn')
      break
    case 'gif':
      // Reasonable web-friendly GIF: 10fps, max width 480.
      a.push('-vf', "fps=10,scale=480:-1:flags=lanczos", '-loop', '0')
      break
    case 'mp4':
      a.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(opts.crf ?? 23), '-c:a', 'aac')
      break
    case 'webm':
      a.push('-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(opts.crf ?? 32), '-c:a', 'libopus')
      break
    default:
      break
  }
  a.push(output)
  return a
}

/**
 * Convert an audio/video file. Returns a Blob.
 * onProgress(0..1) fires during loading and transcoding.
 */
export async function convertMedia(file, to, fromExt, { onProgress, ...opts } = {}) {
  to = normalizeExt(to)
  const ffmpeg = await getFfmpeg(onProgress)
  const { fetchFile } = await import('@ffmpeg/util')

  const inName = `input.${normalizeExt(fromExt)}`
  const outName = `output.${to}`
  await ffmpeg.writeFile(inName, await fetchFile(file))

  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.min(1, progress)))
  await ffmpeg.exec(argsFor(inName, outName, to, opts))

  const data = await ffmpeg.readFile(outName)
  await ffmpeg.deleteFile(inName).catch(() => {})
  await ffmpeg.deleteFile(outName).catch(() => {})

  const mimeMap = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    gif: 'image/gif',
  }
  return new Blob([data.buffer], { type: mimeMap[to] || 'application/octet-stream' })
}
