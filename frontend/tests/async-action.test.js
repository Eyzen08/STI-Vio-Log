import test from 'node:test'
import assert from 'node:assert/strict'
import { createActionLock, formatActionCount } from '../src/lib/asyncAction.js'
import { installMutationRequestGuard } from '../src/lib/api.js'

test('action lock drops repeated work until the first action settles', async () => {
  const run = createActionLock()
  let calls = 0
  let release
  const pending = new Promise((resolve) => { release = resolve })
  const first = run('approve-12', async () => { calls += 1; await pending; return 'done' })
  const duplicate = run('approve-12', async () => { calls += 1 })
  assert.equal(await duplicate, undefined)
  assert.equal(calls, 1)
  release()
  assert.equal(await first, 'done')
  await run('approve-12', async () => { calls += 1 })
  assert.equal(calls, 2)
})

test('action count formatting hides zero and caps large values', () => {
  assert.equal(formatActionCount(0), '')
  assert.equal(formatActionCount(8), '8')
  assert.equal(formatActionCount(120), '99+')
})

test('mutation request guard sends identical concurrent mutations once', async () => {
  let calls = 0
  let release
  const pending = new Promise((resolve) => { release = resolve })
  const response = { clone: () => response }
  const target = { fetch: async () => { calls += 1; await pending; return response } }
  installMutationRequestGuard(target)
  const first = target.fetch('/approve/12', { method: 'PATCH', body: '{"approve":true}' })
  const duplicate = target.fetch('/approve/12', { method: 'PATCH', body: '{"approve":true}' })
  assert.equal(calls, 1)
  release()
  assert.equal(await first, response)
  assert.equal(await duplicate, response)
})
