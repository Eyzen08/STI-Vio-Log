import { isAuthenticationRejection } from './api.js'
import { waitForRetry } from './serviceStartup.js'
const aborted = () => new DOMException('Session check cancelled', 'AbortError')

export async function restoreSession(request, { timeoutMs = 20000, retryDelayMs = 1000, attempts = 3, signal } = {}) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal?.aborted) throw aborted()
    const controller = new AbortController()
    let timer
    let rejectCancelled
    const cancelled = new Promise((_, reject) => { rejectCancelled = reject })
    const cancel = () => { controller.abort(); rejectCancelled(aborted()) }
    signal?.addEventListener('abort', cancel, { once: true })
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(Object.assign(new Error('Session request timed out'), { code: 'SESSION_TIMEOUT' }))
        controller.abort()
      }, timeoutMs)
    })
    try {
      const data = await Promise.race([request(controller.signal), deadline, cancelled])
      if (!data?.user) throw Object.assign(new Error('Invalid session response'), { code: 'INVALID_RESPONSE' })
      return data
    } catch (error) {
      if (signal?.aborted || isAuthenticationRejection(error)) throw error
      lastError = error
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
    }
    if (attempt < attempts - 1) await waitForRetry(Math.max(retryDelayMs, lastError?.retryAfterMs || 0), signal)
  }
  throw lastError
}
