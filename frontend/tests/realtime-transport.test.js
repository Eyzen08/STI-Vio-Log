import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { once } from 'node:events'
import { io } from 'socket.io-client'
import { realtimeOptions } from '../src/lib/realtime.js'

// Exercise the frontend against the same Socket.IO dependency as the backend.
const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url))
const { Server } = requireBackend('socket.io')

const startServer = async (t, transports) => {
  const httpServer = createServer()
  const server = new Server(httpServer, { transports })
  t.after(() => new Promise((resolve) => server.close(resolve)))
  httpServer.listen(0, '127.0.0.1')
  await once(httpServer, 'listening')
  return { server, url: `http://127.0.0.1:${httpServer.address().port}` }
}

test('production receives live events and reconnects when WebSocket is unavailable', { timeout: 10000 }, async (t) => {
  const { server, url } = await startServer(t, ['polling'])
  const options = realtimeOptions(true)
  assert.equal(options.withCredentials, true)
  assert.equal(options.reconnection, true)
  const socket = io(url, { ...options, autoConnect: false, reconnectionDelay: 10, reconnectionDelayMax: 20 })
  t.after(() => socket.disconnect())
  let upgrades = 0
  server.on('connection', (peer) => {
    assert.equal(peer.conn.transport.name, 'polling')
    peer.conn.on('upgrade', () => { upgrades += 1 })
    peer.emit('messages:changed', { refreshed: true })
    peer.emit('community-service:changed', { refreshed: true })
  })
  const message = once(socket, 'messages:changed')
  const attendance = once(socket, 'community-service:changed')
  const connected = once(socket, 'connect')
  socket.connect()
  await connected
  assert.deepEqual((await message)[0], { refreshed: true })
  assert.deepEqual((await attendance)[0], { refreshed: true })
  assert.equal(socket.io.engine.transport.name, 'polling')
  assert.deepEqual(socket.io.engine.opts.transports.map((transport) => transport.prototype.name), ['polling'])
  assert.equal(socket.io.engine.opts.upgrade, false)

  const reconnected = once(socket, 'connect')
  socket.io.engine.close()
  await reconnected
  assert.equal(socket.io.engine.transport.name, 'polling')
  assert.equal(upgrades, 0)
  socket.disconnect()
  assert.equal(socket.connected, false)
  assert.equal(socket.active, false)
})

test('local development starts with polling and upgrades to WebSocket', { timeout: 10000 }, async (t) => {
  const { server, url } = await startServer(t, ['polling', 'websocket'])
  const initialTransport = new Promise((resolve) => server.on('connection', (peer) => resolve(peer.conn.transport.name)))
  const socket = io(url, { ...realtimeOptions(false), autoConnect: false })
  t.after(() => socket.disconnect())
  const connected = once(socket, 'connect')
  socket.connect()
  const upgraded = once(socket.io.engine, 'upgrade')
  await connected
  assert.equal(await initialTransport, 'polling')
  await upgraded
  assert.equal(socket.io.engine.transport.name, 'websocket')
})
