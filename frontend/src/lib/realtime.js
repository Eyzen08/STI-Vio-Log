import { io } from 'socket.io-client'
import { API_URL } from './api.js'

export const realtimeOptions = (production = Boolean(import.meta.env?.PROD)) => ({
  withCredentials: true,
  // Keep production traffic on the authenticated HTTP proxy without attempting
  // a WebSocket upgrade. Local development can upgrade after polling connects.
  transports: production ? ['polling'] : ['polling', 'websocket'],
  upgrade: !production,
  reconnection: true,
  timeout: 10000
})

export const connectRealtime = () => io(API_URL, realtimeOptions())
