import { ApiError, apiRequest } from './api.js'

export const waitForRetry = (ms, signal) => new Promise((resolve, reject) => {
  const cancel = () => { clearTimeout(timer); reject(new DOMException('Request cancelled', 'AbortError')) }
  const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve() }, ms)
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
})

// Only health GETs are retried; credential submissions must never be replayed.
export async function prepareLoginService({ signal, onProgress = () => {}, request = apiRequest, deadlineMs = 90000, now = Date.now, wait = waitForRetry } = {}) {
  const deadline = now() + deadlineMs
  let lastError
  while (now() < deadline) {
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
    onProgress(lastError ? 'The service is starting or reconnecting. Your entries are kept here…' : 'Connecting to the service…')
    try {
      const data = await request('/api/health', { signal, timeoutMs: Math.min(10000, deadline - now()) })
      if (data?.success !== true || ['disconnected', 'unavailable'].includes(data.database)) throw new ApiError('The service is starting. Please try again.', { code: 'SERVICE_UNAVAILABLE' })
      onProgress('')
      return
    } catch (error) {
      if (signal?.aborted || error.name === 'AbortError') throw error
      lastError = error
      if (error.code === 'OFFLINE') { onProgress(''); throw error }
      const delay = Math.max(3000, error.retryAfterMs || 0)
      if (now() + delay >= deadline) break
      await wait(delay, signal)
    }
  }
  onProgress('')
  throw lastError || new ApiError('The service is still starting. Please try again.', { code: 'SERVICE_UNAVAILABLE' })
}
