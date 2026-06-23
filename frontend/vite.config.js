import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ffmpeg.wasm requires cross-origin isolation (SharedArrayBuffer).
// These headers enable it in dev and preview.
const coiHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react()],
  server: {
    headers: coiHeaders,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    headers: coiHeaders,
  },
  // pdfjs-dist and ffmpeg ship large prebuilt assets; keep them external-friendly
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  worker: {
    format: 'es',
  },
})
