import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, apiRequest, installMutationRequestGuard, loadAllPages } from '../src/lib/api.js'

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
    fetch: async () => response(401),
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
