import { io } from 'socket.io-client'
import { API_URL } from './api.js'

export const connectRealtime = (token) => io(API_URL, {
  auth: { token },
  transports: ['websocket', 'polling'],
  reconnection: true,
  timeout: 10000
})
