import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionFailure, routeFailure, recoveryDiagnostic, retryOnReconnect } from '../src/lib/recoveryErrors.js'

test('session errors distinguish network, timeout, server and invalid responses without exposing messages', () => {
  assert.equal(sessionFailure(new TypeError('secret')).code, 'NETWORK_ERROR')
  assert.equal(sessionFailure({}, false).code, 'OFFLINE')
  assert.equal(sessionFailure({ code: 'SESSION_TIMEOUT' }).code, 'SESSION_TIMEOUT')
  assert.equal(sessionFailure({ status: 503 }).code, 'SERVICE_UNAVAILABLE')
  assert.equal(sessionFailure({ code: 'INVALID_RESPONSE', status: 200 }).code, 'INVALID_RESPONSE')
  assert.equal(sessionFailure({ message: 'secret', status: 403 }).code, 'SESSION_VERIFICATION_FAILED')
  assert.ok(!JSON.stringify(sessionFailure({ message: 'secret' })).includes('secret'))
})

test('only recognizable module failures suggest an update', () => {
  for (const error of [new TypeError('Failed to fetch dynamically imported module: https://private'), { name: 'ChunkLoadError' }, new Error('Importing a module script failed.')]) {
    assert.equal(routeFailure(error).code, 'MODULE_LOAD_FAILED')
  }
  assert.equal(routeFailure(new Error('Cannot read properties of undefined')).code, 'PAGE_RENDER_FAILED')
  assert.doesNotMatch(routeFailure(new Error('render failed')).message, /updated/)
})

test('diagnostics only include safe metadata', () => {
  assert.deepEqual(recoveryDiagnostic({ status: 503, requestId: 'req-123', message: 'secret', token: 'secret' }, 'SERVICE_UNAVAILABLE'), {
    code: 'SERVICE_UNAVAILABLE', status: 503, requestId: 'req-123'
  })
  assert.deepEqual(recoveryDiagnostic({ status: 'secret', requestId: 'invalid\nsecret' }, 'PAGE_RENDER_FAILED'), { code: 'PAGE_RENDER_FAILED', status: 0 })
})

test('reconnect retries once and cleanup prevents further retries', () => {
  const target = new EventTarget()
  let calls = 0
  const cleanup = retryOnReconnect(target, () => calls++)
  target.dispatchEvent(new Event('online'))
  target.dispatchEvent(new Event('online'))
  assert.equal(calls, 1)
  cleanup()
  const cancel = retryOnReconnect(target, () => calls++)
  cancel()
  target.dispatchEvent(new Event('online'))
  assert.equal(calls, 1)
})
