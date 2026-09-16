import { io } from 'socket.io-client'
import { API_URL } from './api.js'

export const connectRealtime = () => io(API_URL, {
  withCredentials: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  timeout: 10000
})
