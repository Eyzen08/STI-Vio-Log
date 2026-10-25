import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareLoginService } from '../src/lib/serviceStartup.js'

test('slow service startup retries only bounded health GETs before a single credential submission', async () => {
  let clock = 0, health = 0, credentials = 0
  const progress = []
  await prepareLoginService({ now: () => clock, wait: async ms => { clock += ms }, request: async (path, options) => {
    assert.equal(path, '/api/health'); assert.equal(options.method, undefined)
    health++
    if (clock < 60000) throw Object.assign(new Error('Starting'), { status: 503 })
    return { success: true }
  }, onProgress: value => progress.push(value) })
  credentials++
  assert.equal(credentials, 1)
  assert.equal(health, 21)
  assert.equal(progress.at(-1), '')
})

test('startup stops before 90 seconds and respects a longer Retry-After', async () => {
  let clock = 0, calls = 0
  await assert.rejects(prepareLoginService({ now: () => clock, wait: async ms => { clock += ms }, request: async () => {
    calls++; throw Object.assign(new Error('Cooldown'), { status: 429, retryAfterMs: 60000 })
  } }), /Cooldown/)
  assert.equal(clock, 60000); assert.equal(calls, 2)
})

test('startup cancels without sending credentials and offline fails promptly', async () => {
  const controller = new AbortController(); controller.abort()
  let calls = 0
  await assert.rejects(prepareLoginService({ signal: controller.signal, request: async () => { calls++ } }), { name: 'AbortError' })
  assert.equal(calls, 0)
  await assert.rejects(prepareLoginService({ request: async () => { throw Object.assign(new Error('Offline'), { code: 'OFFLINE' }) } }), { code: 'OFFLINE' })
})
