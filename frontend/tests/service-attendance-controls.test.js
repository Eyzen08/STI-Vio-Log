import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'

const source = await readFile(new URL('../src/components/ServiceAttendanceControls.jsx', import.meta.url), 'utf8')
const handler = source.slice(source.indexOf('  const change = async'), source.indexOf('  return <>'))
const setup = (reason = '') => {
  const calls = []
  const state = { pending: { current: false }, disabled: false, limitReached: false, reason, session: { session_id: 42 }, token: 'staff-token', API_URL: '',
    setBusy(value) { state.busy = value }, setError(value) { state.error = value }, setDialog(value) { state.dialog = value }, setReason(value) { state.reason = value },
    onSaved(result, action) { state.saved = { result, action } },
    async fetch(url, options) { calls.push({ url, options }); return { ok: true, json: async () => ({ success: true, session: { id: 42, paused_at: '2026-10-22T01:00:00Z' }, server_time: '2026-10-22T01:00:00Z' }) } }
  }
  return { state, calls, change: runInNewContext(`${handler}; change`, state) }
}

test('pause validates trimmed reason length before contacting the server', async () => {
  for (const reason of ['   ', 'x'.repeat(501)]) {
    const { state, calls, change } = setup(reason)
    await change('pause')
    assert.equal(calls.length, 0)
    assert.match(state.error, /1 to 500/)
  }
})

test('pause saves the trimmed reason and reports the pause action without Time Out', async () => {
  const { state, calls, change } = setup('  Lunch break  ')
  await change('pause')
  assert.equal(calls[0].url, '/api/community-service/sessions/42/pause')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer staff-token')
  assert.deepEqual(JSON.parse(calls[0].options.body), { reason: 'Lunch break' })
  assert.equal(state.saved.action, 'pause')
  assert.equal(state.reason, '')
  assert.equal(state.busy, false)
})

test('resume posts an empty body and preserves errors on rejected writes', async () => {
  const { state, calls, change } = setup()
  await change('resume')
  assert.equal(calls[0].url, '/api/community-service/sessions/42/resume')
  assert.deepEqual(JSON.parse(calls[0].options.body), {})
  assert.equal(state.saved.action, 'resume')
  state.fetch = async () => ({ ok: false, json: async () => ({ success: false, message: 'Session already changed' }) })
  await change('resume')
  assert.equal(state.error, 'Session already changed')
  assert.equal(state.pending.current, false)
})

test('a pending attendance write prevents duplicate actions', async () => {
  const { state, change } = setup('Break')
  let release
  let requests = 0
  state.fetch = () => { requests++; return new Promise(resolve => { release = resolve }) }
  const first = change('pause')
  await change('pause')
  assert.equal(requests, 1)
  release({ ok: true, json: async () => ({ success: true }) })
  await first
})
