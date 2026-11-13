import test from 'node:test'
import assert from 'node:assert/strict'

import { clearSession, loadSession, saveSession } from '../src/lib/session.js'

class MemoryStorage {
  #values = new Map()

  get length() {
    return this.#values.size
  }

  key(index) {
    return [...this.#values.keys()][index] ?? null
  }

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null
  }

  setItem(key, value) {
    this.#values.set(key, String(value))
  }

  removeItem(key) {
    this.#values.delete(key)
  }
}

const user = { id: 7, username: 'student.test', role: 'STUDENT' }

test.beforeEach(() => {
  globalThis.localStorage = new MemoryStorage()
  globalThis.sessionStorage = new MemoryStorage()
})

test.after(() => {
  delete globalThis.localStorage
  delete globalThis.sessionStorage
})

test('only a non-secret user hint is restored while authentication remains in the HttpOnly cookie', () => {
  saveSession({ user, csrf_token:'csrf-not-an-authenticator' })
  assert.deepEqual(loadSession(), { token:'cookie-session', user })
  assert.equal(localStorage.getItem('sti_vio_log_token'),null)
})

test('an invalid persisted user hint is rejected and removed', () => {
  localStorage.setItem('sti_vio_log_user',JSON.stringify({username:'missing-id'}))
  assert.deepEqual(loadSession(), { token: '', user: null })
  assert.equal(localStorage.getItem('sti_vio_log_user'), null)
})

test('persisted session data excludes passwords, hashes and authentication tokens', () => {
  localStorage.setItem('sti_vio_log_token', 'legacy-authentication-token')
  saveSession({
    token: 'authentication-token',
    password: 'private-password',
    user: { ...user, password: 'private-password', password_hash: 'private-hash', token: 'authentication-token' },
    csrf_token: 'csrf-not-an-authenticator'
  })
  assert.deepEqual(JSON.parse(localStorage.getItem('sti_vio_log_user')), user)
  assert.equal(localStorage.getItem('sti_vio_log_token'), null)
  assert.equal(sessionStorage.getItem('sti_vio_log_csrf'), null)
})

test('persisted session data excludes the onboarding email address', () => {
  saveSession({ user: { ...user, onboarding_google_email: 'student@school.test', onboarding_step: 'GOOGLE' } })
  const stored = JSON.parse(localStorage.getItem('sti_vio_log_user'))
  assert.equal(stored.onboarding_google_email, undefined)
  assert.equal(stored.onboarding_step, 'GOOGLE')
})

test('logout clears all persisted authentication data', () => {
  saveSession({ user,csrf_token:'csrf' })
  sessionStorage.setItem('service-attendance-qr:7', 'STI-attendance-code')
  clearSession()

  assert.equal(localStorage.getItem('sti_vio_log_token'), null)
  assert.equal(localStorage.getItem('sti_vio_log_user'), null)
  assert.equal(sessionStorage.getItem('sti_vio_log_csrf'),null)
  assert.equal(sessionStorage.getItem('service-attendance-qr:7'), null)
})
