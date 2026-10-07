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
        reject(new Error('Session request timed out'))
        controller.abort()
      }, timeoutMs)
    })
    try {
      const data = await Promise.race([request(controller.signal), deadline, cancelled])
      if (!data?.user) throw new Error('Invalid session response')
      return data
    } catch (error) {
      if (signal?.aborted || error?.status === 401) throw error
      lastError = error
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
    }
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
  }
  throw lastError
}
