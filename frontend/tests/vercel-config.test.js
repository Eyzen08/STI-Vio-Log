import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

process.env.API_PROXY_ORIGIN = 'https://staging-api.example.edu'
process.env.PRODUCTION_API_ORIGIN = 'https://api.example.edu'
process.env.VERCEL_TARGET_ENV = 'preview'
const { buildConfig } = await import('../vercel.mjs')

test('Vercel proxies API and realtime traffic to the environment-specific backend', () => {
  assert.deepEqual(buildConfig(process.env).rewrites, [
    { source:'/api/:path*', destination:'https://staging-api.example.edu/api/:path*' },
    { source:'/socket.io/:path*', destination:'https://staging-api.example.edu/socket.io/:path*' },
    { source:'/(.*)', destination:'/index.html' }
  ])
})

test('preview deployments cannot use the declared production backend', () => {
  assert.throws(() => buildConfig({ VERCEL_TARGET_ENV:'preview', API_PROXY_ORIGIN:'https://api.example.edu', PRODUCTION_API_ORIGIN:'https://api.example.edu' }), /must not proxy/)
})

test('preview deployments without a backend disable API and Socket.IO proxies', () => {
  assert.deepEqual(buildConfig({ VERCEL_TARGET_ENV:'preview' }).rewrites, [{ source:'/(.*)', destination:'/index.html' }])
})

test('CSP permits only exact API and websocket origins', () => {
  const csp = buildConfig(process.env).headers[0].headers.find(({ key }) => key === 'Content-Security-Policy').value
  assert.match(csp, /connect-src 'self' https:\/\/staging-api\.example\.edu wss:\/\/staging-api\.example\.edu/)
  assert.doesNotMatch(csp, /connect-src 'self' https: wss:/)
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/)
})

test('production build adds an API-origin-specific CSP', () => {
  const source = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')
  assert.match(source,/loadEnv/)
  assert.match(source,/api\.origin/)
  assert.match(source,/connect-src 'self'/)
  assert.doesNotMatch(source,/script-src[^\n]*unsafe-inline/)
  assert.doesNotMatch(source,/unsafe-eval/)
})
