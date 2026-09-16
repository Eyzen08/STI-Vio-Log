import test from 'node:test'
import assert from 'node:assert/strict'

import { clearSession, loadSession, saveSession } from '../src/lib/session.js'

class MemoryStorage {
  #values = new Map()

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

test('logout clears all persisted authentication data', () => {
  saveSession({ user,csrf_token:'csrf' })
  clearSession()

  assert.equal(localStorage.getItem('sti_vio_log_token'), null)
  assert.equal(localStorage.getItem('sti_vio_log_user'), null)
  assert.equal(sessionStorage.getItem('sti_vio_log_csrf'),null)
})
