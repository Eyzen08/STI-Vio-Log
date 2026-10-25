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
    throw Object.assign(new Error('Expired'), { status: 401, code: 'AUTH_REQUIRED' })
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

test('timeouts have a stable error code and abort the timed-out request', async () => {
  let requestSignal
  await assert.rejects(restoreSession((signal) => {
    requestSignal = signal
    return new Promise(() => {})
  }, { attempts: 1, timeoutMs: 5 }), { code: 'SESSION_TIMEOUT' })
  assert.equal(requestSignal.aborted, true)
})

test('invalid session responses retry and expose a stable error code', async () => {
  let calls = 0
  await assert.rejects(restoreSession(async () => {
    calls++
    return { success: true }
  }, { retryDelayMs: 0 }), { code: 'INVALID_RESPONSE' })
  assert.equal(calls, 3)
})

test('a fresh verification cycle can succeed after all earlier attempts failed', async () => {
  const failure = Object.assign(new Error('Unavailable'), { status: 503, requestId: 'req-123' })
  await assert.rejects(restoreSession(async () => { throw failure }, { retryDelayMs: 0 }), error => error === failure)
  assert.deepEqual(await restoreSession(async () => ({ user })), { user })
})

test('a proxy 401 is retried and does not confirm session expiry', async () => {
  let calls=0
  const result=await restoreSession(async () => {
    if (++calls<3) throw Object.assign(new Error('Proxy'),{status:401,code:'INVALID_RESPONSE'})
    return {user}
  },{retryDelayMs:0})
  assert.deepEqual(result.user,user); assert.equal(calls,3)
})
