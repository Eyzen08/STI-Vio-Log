import test from 'node:test'
import assert from 'node:assert/strict'
import { installMutationRequestGuard, loadAllPages } from '../src/lib/api.js'

const response = (status, body = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: () => 'application/json' },
  json: async () => body,
  clone() { return this }
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
