import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('Vercel proxies API and realtime traffic before serving client routes',()=>{const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));assert.deepEqual(config.rewrites,[{source:'/api/:path*',destination:'https://sti-vio-log.onrender.com/api/:path*'},{source:'/socket.io/:path*',destination:'https://sti-vio-log.onrender.com/socket.io/:path*'},{source:'/(.*)',destination:'/index.html'}])})

test('Vercel sends browser security and HTTPS headers', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]))
  assert.match(headers['Strict-Transport-Security'], /max-age=63072000/)
  assert.equal(headers['X-Content-Type-Options'], 'nosniff')
  assert.equal(headers['X-Frame-Options'], 'DENY')
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin')
  assert.match(headers['Permissions-Policy'], /camera=\(self\)/)
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/)
  assert.doesNotMatch(headers['Content-Security-Policy'], /unsafe-eval/)
})

test('production build adds an API-origin-specific CSP',()=>{const source=fs.readFileSync(new URL('../vite.config.js',import.meta.url),'utf8');assert.match(source,/loadEnv/);assert.match(source,/api\.origin/);assert.match(source,/connect-src 'self'/);assert.doesNotMatch(source,/script-src[^\n]*unsafe-inline/);assert.doesNotMatch(source,/unsafe-eval/)});
