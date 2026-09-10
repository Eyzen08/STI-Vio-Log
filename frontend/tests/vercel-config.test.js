import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('Vercel serves client-side routes through the application shell',()=>{const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));assert.deepEqual(config.rewrites,[{source:'/(.*)',destination:'/index.html'}])})

test('Vercel sends browser security and HTTPS headers', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]))
  assert.match(headers['Strict-Transport-Security'], /max-age=63072000/)
  assert.equal(headers['X-Content-Type-Options'], 'nosniff')
  assert.equal(headers['X-Frame-Options'], 'DENY')
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin')
  assert.match(headers['Permissions-Policy'], /camera=\(self\)/)
})
