import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, apiRequest, installMutationRequestGuard, loadAllPages, settleReads } from '../src/lib/api.js'

const response = (status, body = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: () => 'application/json' },
  json: async () => body,
  clone() { return this }
})

test('API requests report readable errors for HTML, malformed JSON and empty responses', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch')
  for (const [status, body, contentType] of [
    [200, '<!DOCTYPE html><title>Portal</title>', 'text/html'],
    [502, '<!DOCTYPE html><title>Bad gateway</title>', 'text/html'],
    [200, '{invalid', 'application/json'],
    [200, '', 'application/json'],
    [200, 'null', 'application/json']
  ]) {
    fetchMock.mock.mockImplementation(async () => new Response(body, { status, headers: { 'content-type': contentType } }))
    await assert.rejects(apiRequest('/api/qr/scan'), error => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, status)
      assert.equal(error.code, 'INVALID_RESPONSE')
      assert.equal(error.message, 'The service is temporarily unavailable. Please try again.')
      return true
    })
  }
})

test('API requests preserve structured server errors and their authentication status', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response(401, { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authenticated session required' } }))
  await assert.rejects(apiRequest('/api/community-service/19/sessions'), { name: 'ApiError', status: 401, code: 'AUTH_REQUIRED', message: 'Authenticated session required' })
})

test('API failures retain request identifiers from JSON and proxy errors', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch')
  for (const headers of [{ 'x-request-id': 'req-123', 'content-type': 'application/json' }, { 'x-vercel-id': 'region::req-456', 'content-type': 'text/html' }]) {
    fetchMock.mock.mockImplementation(async () => new Response(headers['content-type'] === 'application/json' ? '{"success":false}' : '<html>Unavailable</html>', { status: 503, headers }))
    await assert.rejects(apiRequest('/api/auth/session'), error => {
      assert.equal(error.requestId, headers['x-request-id'] || headers['x-vercel-id'])
      assert.equal(error.status, 503)
      return true
    })
  }
})

test('paginated loader retrieves records beyond the first 100', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    const page = Number(new URL(String(url)).searchParams.get('page'))
    const count = page === 1 ? 100 : 25
    return response(200, { students: Array.from({ length: count }, (_, index) => ({ id: (page - 1) * 100 + index + 1 })) })
  }
  try {
    const students = await loadAllPages('/api/students', 'students')
    assert.equal(students.length, 125)
    assert.equal(calls.length, 2)
    assert.match(calls[1], /page=2/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('protected 401 clears cached session, emits expiry, and returns to login', async () => {
  const originalStorage = globalThis.localStorage
  const removed = []
  globalThis.localStorage = { removeItem: (key) => removed.push(key) }
  let expired = false
  let replaced = ''
  const target = {
    fetch: async () => response(401, { success: false, error: { code: 'AUTH_REQUIRED' } }),
    location: { origin: 'https://portal.example.test', pathname: '/student/dashboard', replace: (path) => { replaced = path } },
    CustomEvent: class { constructor(type) { this.type = type } },
    dispatchEvent: (event) => { expired = event.type === 'sti:session-expired' }
  }
  try {
    installMutationRequestGuard(target)
    await target.fetch('/api/students/me')
    assert.deepEqual(removed.sort(), ['sti_vio_log_token', 'sti_vio_log_user'])
    assert.equal(expired, true)
    assert.equal(replaced, '/login')
  } finally {
    globalThis.localStorage = originalStorage
  }
})

test('login failures remain local to the authentication form', async () => {
  let replaced = false
  const target = {
    fetch: async () => response(401),
    location: { origin: 'https://portal.example.test', pathname: '/login', replace: () => { replaced = true } }
  }
  installMutationRequestGuard(target)
  await target.fetch('/api/login', { method: 'POST', body: '{}' })
  assert.equal(replaced, false)
})

test('proxy 401 and transient errors do not expire a cached session', async () => {
  for (const status of [401, 502, 503]) {
    const events = []
    const target = { fetch: async () => new Response('<html>Gateway</html>', { status, headers: { 'content-type': 'text/html' } }),
      CustomEvent: class { constructor(type) { this.type = type } }, dispatchEvent: event => events.push(event.type) }
    installMutationRequestGuard(target)
    await target.fetch('/api/auth/session')
    assert.deepEqual(events, [])
  }
})

test('rate limits retain cooldowns even when the proxy returns HTML', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Wait</html>', { status: 429, headers: { 'content-type': 'text/html', 'retry-after': '65', 'x-request-id': 'safe:123' } }))
  await assert.rejects(apiRequest('/api/auth/session'), { code: 'RATE_LIMITED', status: 429, retryAfterMs: 65000, requestId: 'safe:123' })
})

test('network failures and timeouts are distinct and do not replay POSTs', async (t) => {
  let calls = 0
  const mock = t.mock.method(globalThis, 'fetch', async () => { calls++; throw new TypeError('fetch failed') })
  await assert.rejects(apiRequest('/api/login', { method: 'POST' }), { code: 'NETWORK_ERROR' })
  assert.equal(calls, 1)
  mock.mock.mockImplementation(async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))))
  await assert.rejects(apiRequest('/api/login', { method: 'POST', timeoutMs: 5 }), { code: 'TIMEOUT' })
})

test('offline errors remain distinct and unsafe request identifiers are discarded', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { configurable:true, value:{onLine:false} })
  t.after(() => Object.defineProperty(globalThis, 'navigator', descriptor))
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network') })
  await assert.rejects(apiRequest('/api/health'), {code:'OFFLINE'})
  assert.equal(new ApiError('Failure',{requestId:'<unsafe>token'}).requestId, undefined)
})

test('a failed read batch waits for outstanding reads and retains the longest cooldown', async () => {
  let finish, completed = false
  const cooldown = new ApiError('Wait',{retryAfterMs:65000})
  const pending = settleReads([Promise.reject(new Error('Unavailable')), Promise.reject(cooldown), new Promise(resolve => { finish=resolve })])
  pending.catch(() => { completed=true })
  await Promise.resolve(); await Promise.resolve(); assert.equal(completed,false)
  finish({success:true})
  await assert.rejects(pending, error => error === cooldown)
})

test('session expiry is handled again after a later account signs in', async (t) => {
  const originalStorage=globalThis.localStorage
  globalThis.localStorage={removeItem(){}}
  t.after(()=>{globalThis.localStorage=originalStorage})
  let expired=0
  const target={ fetch:async path => path === '/api/login' ? new Response('{"user":{"id":8}}',{headers:{'content-type':'application/json'}}) : new Response('{"error":{"code":"AUTH_REQUIRED"}}',{status:401,headers:{'content-type':'application/json'}}),
    CustomEvent:class { constructor(type) { this.type=type } },dispatchEvent:event=>{if(event.type==='sti:session-expired') expired++} }
  installMutationRequestGuard(target)
  await target.fetch('/api/auth/session'); await target.fetch('/api/auth/session')
  assert.equal(expired,1)
  await target.fetch('/api/login',{method:'POST',body:'{}'})
  await target.fetch('/api/auth/session')
  assert.equal(expired,2)
})
