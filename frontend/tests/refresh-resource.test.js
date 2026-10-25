import test from 'node:test'
import assert from 'node:assert/strict'
import { createRefreshResource } from '../src/lib/refreshResource.js'

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
function environment() {
  let now = 1000, nextId = 0
  const timers = new Map()
  const target = new EventTarget()
  target.navigator = { onLine: true }
  const document = new EventTarget(); document.visibilityState = 'visible'
  const socket = new EventTarget(); socket.connected = true
  socket.on = (name, cb) => socket.addEventListener(name, cb)
  socket.off = (name, cb) => socket.removeEventListener(name, cb)
  socket.emit = name => socket.dispatchEvent(new Event(name))
  const clock = { now: () => now, setTimeout: (cb, ms) => { const id = ++nextId; timers.set(id, { cb, at: now + ms }); return id }, clearTimeout: id => timers.delete(id) }
  const advance = async ms => {
    await settle()
    const end = now + ms
    while (true) {
      const first = [...timers].sort((a,b) => a[1].at-b[1].at)[0]
      if (!first || first[1].at > end) break
      now = first[1].at; timers.delete(first[0]); first[1].cb(); await settle()
    }
    now = end; await settle()
  }
  return { target, document, socket, clock, advance, timers }
}

for (const [role, heavyReads] of [['DISCIPLINE_ADMIN', 6], ['DISCIPLINE_OFFICE', 6], ['DEPARTMENT_HEAD', 3], ['STUDENT', 5]]) {
  test(`${role}: two tabs run for sixteen minutes within the shared account read budget`, async () => {
    const env = environment(); let reads = 0
    const resources = []
    for (let tab = 0; tab < 2; tab++) {
      resources.push(createRefreshResource({ ...env, load: async () => { reads++; return [] }, onData: () => {} }))
      for (const [cost,event] of [[heavyReads,'community-service:changed'], [1,'notifications:changed'],[1,'messages:changed'], ...(role.startsWith('DISCIPLINE') ? [[1,'community-service:changed']] : [])]) {
        resources.push(createRefreshResource({ ...env, intervalMs: 60000, event, load: async () => { reads += cost; return [] }, onData: () => {} }))
      }
    }
    await env.advance(4*60000)
    const before = reads
    for (let i = 0; i < 40; i++) env.socket.emit('notifications:changed')
    await env.advance(200)
    assert.equal(reads-before, 2, 'notification burst refreshes only notifications once per tab')
    env.socket.emit('disconnect')
    env.target.navigator.onLine = false; env.target.dispatchEvent(new Event('offline'))
    const offlineReads = reads
    await env.advance(60000); assert.equal(reads, offlineReads)
    env.target.navigator.onLine = true; env.target.dispatchEvent(new Event('online')); env.socket.emit('connect')
    await env.advance(11*60000)
    assert.ok(reads < 600, `shared account ${reads} reads`)
    resources.forEach(resource => resource.dispose())
    assert.equal(env.timers.size, 0)
  })
}

test('failure backoff is 5/15/30/60 seconds, preserves snapshots and honors longer server cooldowns', async () => {
  const env = environment(); const calls = [], values = [], statuses = []
  let failure = false, retryAfterMs = 0
  const resource = createRefreshResource({ ...env, load: async () => { calls.push(env.clock.now()); if (failure) throw Object.assign(new Error('Unavailable'), { retryAfterMs }); return { sessions: [7] } }, onData: data => values.push(data), onStatus: status => statuses.push(status) })
  await env.advance(0); failure = true
  await resource.refresh(); await settle()
  const start = calls.at(-1)
  await env.advance(110000)
  assert.deepEqual(calls.slice(2).map(time => time-start), [5000,20000,50000,110000])
  assert.deepEqual(values, [{ sessions:[7] }]); assert.equal(statuses.at(-1).lastSuccess, 1000)
  retryAfterMs = 90000; await resource.refresh(); await settle()
  const count = calls.length
  failure = false
  await resource.refresh(); env.socket.emit('connect'); await env.advance(89999)
  assert.equal(calls.length,count)
  await env.advance(1); assert.equal(statuses.at(-1).error, ''); assert.equal(values.length, 2)
  await env.advance(15000); assert.equal(values.length, 3)
  resource.dispose()
})

test('inflight events queue one trailing refresh; disposal rejects previous-account results', async () => {
  const env = environment(); const resolves = [], values = []
  let inflight = 0, maxInflight = 0
  const resource = createRefreshResource({ ...env, load: signal => { inflight++; maxInflight=Math.max(maxInflight,inflight); return new Promise(resolve => resolves.push(value => { inflight--; resolve({ value, aborted:signal.aborted }) })) }, onData: data => values.push(data) })
  await env.advance(0)
  for (let i = 0; i < 30; i++) env.socket.emit('community-service:changed')
  await env.advance(200); resource.refresh()
  resolves[0]('initial'); await settle()
  assert.equal(resolves.length, 2); assert.equal(maxInflight, 1)
  resource.dispose(); resolves[1]('old account'); await settle()
  assert.equal(values.length, 1)
  assert.equal(env.timers.size, 0)
})

test('visibility recovery immediately refreshes and errors clear only after valid data', async () => {
  const env = environment(); let calls = 0; const statuses = []
  const resource = createRefreshResource({ ...env, load: async () => { calls++; if (calls === 2) throw new Error('Malformed attendance'); return { sessions: [] } }, onData: () => {}, onStatus: value => statuses.push(value) })
  await env.advance(0)
  env.document.visibilityState='hidden'; env.document.dispatchEvent(new Event('visibilitychange'))
  await env.advance(60000); assert.equal(calls,1)
  env.document.visibilityState='visible'; env.document.dispatchEvent(new Event('visibilitychange')); await settle()
  assert.equal(calls,2); assert.equal(statuses.at(-1).error,'Malformed attendance')
  env.socket.emit('disconnect'); assert.equal(statuses.at(-1).error,'Malformed attendance')
  await resource.refresh(); await settle(); assert.equal(calls,3); assert.equal(statuses.at(-1).error,'')
  resource.dispose()
})
