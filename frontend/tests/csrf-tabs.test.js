import test from 'node:test'
import assert from 'node:assert/strict'
import { installMutationRequestGuard } from '../src/lib/api.js'
import { csrfToken } from '../src/lib/session.js'

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

test('tabs use the shared cookie even when their session storage contains different stale tokens', async () => {
  const shared = { cookie: 'other=value; sti_csrf=current-token', addEventListener() {} }
  const sent = []
  const tabs = ['old-token', 'another-old-token'].map(stale => {
    const target = {
      document: shared,
      sessionStorage: { getItem: () => stale },
      fetch: async (url, options) => { sent.push([url, new Headers(options.headers).get('X-CSRF-Token')]); return json({ success: true }) }
    }
    installMutationRequestGuard(target)
    return target
  })
  await tabs[0].fetch('/api/qr/scan', { method: 'POST' })
  shared.cookie = 'sti_csrf=recovered-token'
  await tabs[1].fetch('/api/qr/scan', { method: 'POST' })
  await tabs[0].fetch('/api/qr/scan', { method: 'POST' })
  assert.deepEqual(sent, [['/api/qr/scan', 'current-token'], ['/api/qr/scan', 'recovered-token'], ['/api/qr/scan', 'recovered-token']])
})

test('CSRF cookie parsing handles missing, exact names, encoded and malformed values', () => {
  for (const [cookie, expected] of [['', ''], ['not_sti_csrf=wrong', ''], ['sti_csrf=a%2Bb; other=x', 'a+b'], ['sti_csrf=%ZZ', ''], ['sti_csrf=', '']]) {
    assert.equal(csrfToken({ cookie }), expected)
  }
})

test('concurrent bootstrap is shared and duplicate attendance writes remain deduplicated', async () => {
  const document = { cookie: '', addEventListener() {} }
  let releaseBootstrap, releaseWrite
  const bootstrap = new Promise(resolve => { releaseBootstrap = resolve })
  const write = new Promise(resolve => { releaseWrite = resolve })
  let bootstraps = 0, writes = 0
  const target = { document, fetch: async (url, options) => {
    if (url.endsWith('/api/auth/csrf')) { bootstraps++; await bootstrap; document.cookie = 'sti_csrf=ready'; return json({ success: true, csrf_token: 'ready' }) }
    writes++
    assert.equal(options.headers.get('X-CSRF-Token'), 'ready')
    await write
    return json({ success: true })
  } }
  installMutationRequestGuard(target)
  const first = target.fetch('/api/attendance', { method: 'POST', body: '{}' })
  const duplicate = target.fetch('/api/attendance', { method: 'POST', body: '{}' })
  releaseBootstrap()
  await new Promise(resolve => setImmediate(resolve))
  releaseWrite()
  await Promise.all([first, duplicate])
  assert.equal(bootstraps, 1)
  assert.equal(writes, 1)
})

test('failed bootstrap never submits a protected action and permits a later explicit attempt', async () => {
  for (const failure of [() => new Response('<html>Gateway</html>', { status: 502 }), () => new Response('{bad', { headers: { 'content-type': 'application/json' } }), () => json({ success: false, message: 'Unavailable' }, 503), () => json({ success: true, csrf_token: 'blocked-cookie' }), () => { throw new TypeError('Failed to fetch') }]) {
    const document = { cookie: '', addEventListener() {} }
    let fail = true, writes = 0
    const target = { document, fetch: async url => {
      if (url.endsWith('/api/auth/csrf')) {
        if (fail) return failure()
        document.cookie = 'sti_csrf=ready'
        return json({ success: true, csrf_token: 'ready' })
      }
      writes++
      return json({ success: true })
    } }
    installMutationRequestGuard(target)
    await assert.rejects(target.fetch('/api/attendance', { method: 'POST' }), error => error.name === 'ApiError' && !/JSON|DOCTYPE|Failed to fetch/.test(error.message))
    assert.equal(writes, 0)
    fail = false
    await target.fetch('/api/attendance', { method: 'POST' })
    assert.equal(writes, 1)
  }
})

test('expired bootstrap expires the login and never submits attendance', async (t) => {
  const storage = globalThis.localStorage
  globalThis.localStorage = { removeItem() {} }
  t.after(() => { if (storage === undefined) delete globalThis.localStorage; else globalThis.localStorage = storage })
  const events = []
  let writes = 0, redirect
  const target = {
    document: { cookie: '', addEventListener() {} },
    location: { pathname: '/admin/qr-scan', replace: path => { redirect = path } },
    CustomEvent: class { constructor(type) { this.type = type } },
    dispatchEvent: event => events.push(event.type),
    fetch: async url => { if (!url.endsWith('/api/auth/csrf')) writes++; return json({ message: 'Session expired' }, 401) }
  }
  installMutationRequestGuard(target)
  await assert.rejects(target.fetch('/api/attendance', { method: 'POST' }), { status: 401 })
  assert.equal(writes, 0)
  assert.deepEqual(events, ['sti:session-expired'])
  assert.equal(redirect, '/login')
})

test('a rejected CSRF write is returned without an automatic retry', async () => {
  let writes = 0
  const target = { document: { cookie: 'sti_csrf=present', addEventListener() {} }, fetch: async () => { writes++; return json({ error: { code: 'CSRF_INVALID' } }, 403) } }
  installMutationRequestGuard(target)
  assert.equal((await target.fetch('/api/attendance', { method: 'POST' })).status, 403)
  assert.equal(writes, 1)
})
