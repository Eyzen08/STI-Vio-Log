const retryDelays = [5000, 15000, 30000, 60000]

export function createRefreshResource({ load, onData, onStatus = () => {}, intervalMs = 15000,
  target = globalThis, document: documentRef = target.document, socket, event = 'community-service:changed',
  clock = { now: () => Date.now(), setTimeout: (...args) => target.setTimeout(...args), clearTimeout: id => target.clearTimeout(id) } }) {
  let disposed = false
  let timer
  let burstTimer
  let controller
  let inFlight
  let trailing = false
  let failures = 0
  let retryAt = 0
  let serverRetryAt = 0
  let status = { error: '', lastSuccess: null, loading: false, offline: target.navigator?.onLine === false, connected: Boolean(socket?.connected) }
  const publish = patch => { status = { ...status, ...patch }; if (!disposed) onStatus(status) }
  const available = () => !disposed && !status.offline && documentRef?.visibilityState !== 'hidden'
  const clearTimer = () => { clock.clearTimeout(timer); timer = undefined }
  const schedule = delay => {
    clearTimer()
    if (available()) timer = clock.setTimeout(() => request('poll'), Math.max(0, delay))
  }
  const request = (reason = 'manual') => {
    if (!available()) return Promise.resolve()
    if (inFlight) {
      if (reason !== 'poll') trailing = true
      return inFlight
    }
    const earliest = reason === 'manual' || reason === 'recovery' ? serverRetryAt : retryAt
    if (clock.now() < earliest) { schedule(earliest - clock.now()); return Promise.resolve() }
    clearTimer()
    clock.clearTimeout(burstTimer)
    burstTimer = undefined
    controller = new AbortController()
    const signal = controller.signal
    publish({ loading: true })
    inFlight = Promise.resolve().then(() => load(signal)).then(value => {
      if (disposed || signal.aborted) return
      onData(value)
      failures = 0
      retryAt = serverRetryAt = 0
      publish({ error: '', lastSuccess: clock.now() })
    }).catch(error => {
      if (disposed || signal.aborted) return
      const retryAfter = Math.max(0, Number(error?.retryAfterMs) || 0)
      serverRetryAt = clock.now() + retryAfter
      retryAt = clock.now() + Math.max(retryDelays[Math.min(failures++, retryDelays.length - 1)], retryAfter)
      publish({ error: error?.message || 'Unable to refresh records. Please try again.' })
    }).finally(() => {
      inFlight = undefined
      if (disposed) return
      publish({ loading: false })
      const again = trailing
      trailing = false
      if (again) request('event')
      else schedule(retryAt > clock.now() ? retryAt - clock.now() : intervalMs)
    })
    return inFlight
  }
  const changed = () => {
    if (!available() || burstTimer !== undefined) return
    burstTimer = clock.setTimeout(() => { burstTimer = undefined; request('event') }, 200)
  }
  const recover = () => {
    publish({ offline: target.navigator?.onLine === false })
    if (available()) request('recovery')
    else clearTimer()
  }
  const offline = () => { publish({ offline: true }); clearTimer() }
  const connected = () => { publish({ connected: true }); recover() }
  const disconnected = () => publish({ connected: false })
  target.addEventListener?.('online', recover)
  target.addEventListener?.('offline', offline)
  documentRef?.addEventListener('visibilitychange', recover)
  socket?.on(event, changed)
  socket?.on('connect', connected)
  socket?.on('disconnect', disconnected)
  socket?.on('connect_error', disconnected)
  publish({})
  request('poll')
  return {
    refresh: () => request('manual'),
    dispose() {
      disposed = true
      controller?.abort()
      clearTimer()
      clock.clearTimeout(burstTimer)
      target.removeEventListener?.('online', recover)
      target.removeEventListener?.('offline', offline)
      documentRef?.removeEventListener('visibilitychange', recover)
      socket?.off(event, changed)
      socket?.off('connect', connected)
      socket?.off('disconnect', disconnected)
      socket?.off('connect_error', disconnected)
    }
  }
}
