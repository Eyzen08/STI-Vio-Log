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

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const tokenFor = (payload) => `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
const user = { id: 7, username: 'student.test', role: 'STUDENT' }

test.beforeEach(() => {
  globalThis.localStorage = new MemoryStorage()
})

test.after(() => {
  delete globalThis.localStorage
})

test('a valid persisted session is restored on reload', () => {
  const token = tokenFor({ ...user, exp: Math.floor(Date.now() / 1000) + 3600 })
  saveSession({ token, user })

  assert.deepEqual(loadSession(), { token, user })
})

test('an expired session is rejected and removed', () => {
  const token = tokenFor({ ...user, exp: Math.floor(Date.now() / 1000) - 1 })
  saveSession({ token, user })

  assert.deepEqual(loadSession(), { token: '', user: null })
  assert.equal(localStorage.getItem('sti_vio_log_token'), null)
  assert.equal(localStorage.getItem('sti_vio_log_user'), null)
})

test('a session with a tampered persisted identity is rejected and removed', () => {
  const token = tokenFor({ ...user, exp: Math.floor(Date.now() / 1000) + 3600 })
  saveSession({ token, user: { ...user, role: 'ADMIN' } })

  assert.deepEqual(loadSession(), { token: '', user: null })
  assert.equal(localStorage.getItem('sti_vio_log_token'), null)
  assert.equal(localStorage.getItem('sti_vio_log_user'), null)
})

test('logout clears all persisted authentication data', () => {
  const token = tokenFor({ ...user, exp: Math.floor(Date.now() / 1000) + 3600 })
  saveSession({ token, user })
  clearSession()

  assert.equal(localStorage.getItem('sti_vio_log_token'), null)
  assert.equal(localStorage.getItem('sti_vio_log_user'), null)
})

test('forced-password-change state must match the signed token', () => {
  const token = tokenFor({ ...user, password_change_required:true, exp:Math.floor(Date.now()/1000)+3600 })
  saveSession({token,user:{...user,password_change_required:false}})
  assert.deepEqual(loadSession(),{token:'',user:null})
})
