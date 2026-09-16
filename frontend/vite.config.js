import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let apiOrigin = "'self'"
  let socketOrigin = "'self'"
  try {
    const api = new URL(env.VITE_API_URL)
    apiOrigin = api.origin
    socketOrigin = `${api.protocol === 'https:' ? 'wss:' : 'ws:'}//${api.host}`
  } catch {
    // Local development uses the API fallback and Vite does not serve this CSP in dev.
  }
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "script-src 'self' https://accounts.google.com/gsi/client",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
    "img-src 'self' data: https://*.googleusercontent.com",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin} ${socketOrigin} https://accounts.google.com`,
    "frame-src https://accounts.google.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ')

  return {
    plugins: [
      react(),
      {
        name: 'exact-production-csp',
        transformIndexHtml: {
          order: 'pre',
          handler: () => ({ tags: [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }] }),
        },
      },
    ],
  }
})
