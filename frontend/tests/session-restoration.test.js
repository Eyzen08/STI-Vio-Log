import test from 'node:test'
import assert from 'node:assert/strict'
import { restoreSession } from '../src/lib/restoreSession.js'

const user = { id: 7, role: 'STUDENT' }

test('delayed valid session restores without a second request', async () => {
  let calls = 0
  const result = await restoreSession(async () => {
    calls += 1
    await new Promise((resolve) => setTimeout(resolve, 5))
    return { user }
  }, { timeoutMs: 1000, retryDelayMs: 0 })
  assert.deepEqual(result.user, user)
  assert.equal(calls, 1)
})

test('transient failures retry and eventually restore the session', async () => {
  let calls = 0
  const result = await restoreSession(async () => {
    calls += 1
    if (calls < 3) throw new Error('Temporary failure')
    return { user }
  }, { timeoutMs: 1000, retryDelayMs: 0 })
  assert.deepEqual(result.user, user)
  assert.equal(calls, 3)
})

test('a request that never settles times out and leaves recovery available', async () => {
  let calls = 0
  await assert.rejects(restoreSession(() => {
    calls += 1
    return new Promise(() => {})
  }, { timeoutMs: 5, retryDelayMs: 0 }), /timed out/i)
  assert.equal(calls, 3)
})

test('a confirmed invalid session does not retry', async () => {
  let calls = 0
  await assert.rejects(restoreSession(async () => {
    calls += 1
    throw Object.assign(new Error('Expired'), { status: 401 })
  }, { timeoutMs: 1000, retryDelayMs: 0 }), { status: 401 })
  assert.equal(calls, 1)
})

test('three failed attempts stop and expose the failure', async () => {
  let calls = 0
  await assert.rejects(restoreSession(async () => {
    calls += 1
    throw new Error('Service unavailable')
  }, { timeoutMs: 1000, retryDelayMs: 0 }), /Service unavailable/)
  assert.equal(calls, 3)
})

test('leaving session restoration cancels an outstanding request', async () => {
  const controller = new AbortController()
  const restoring = restoreSession(() => new Promise(() => {}), { timeoutMs: 1000, retryDelayMs: 0, signal: controller.signal })
  controller.abort()
  await assert.rejects(restoring, { name: 'AbortError' })
})
