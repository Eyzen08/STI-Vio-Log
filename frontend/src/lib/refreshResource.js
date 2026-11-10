const retryDelays = [5000, 15000, 30000, 60000]

const isAbortError = error => error?.name === 'AbortError'

const refreshLog = (payload) => {
  const quiet = payload.event === 'refresh_start' || payload.event === 'refresh_success'
  if (quiet && !import.meta.env?.DEV) return
  console.info(JSON.stringify({ source: 'sti-refresh', ...payload }))
}

export function createRefreshResource({ load, onData, onStatus = () => {}, intervalMs = 15000,
  target = globalThis, document: documentRef = target.document, socket, event = 'community-service:changed',
  clock = { now: () => Date.now(), setTimeout: (...args) => target.setTimeout(...args), clearTimeout: id => target.clearTimeout(id) } }) {
  let disposed = false
  let timer
  let burstTimer
  let controller
  let inFlight
  let inFlightReason = ''
  let trailing = false
  let failures = 0
  let retryAt = 0
  let serverRetryAt = 0
  let activeSocket
  let status = { error: '', lastSuccess: null, loading: false, offline: target.navigator?.onLine === false, connected: false }
  const publish = patch => { status = { ...status, ...patch }; if (!disposed) onStatus(status) }
  const available = () => !disposed && !status.offline && documentRef?.visibilityState !== 'hidden'
  const clearTimer = () => { clock.clearTimeout(timer); timer = undefined }
  const schedule = delay => {
    clearTimer()
    if (available()) timer = clock.setTimeout(() => request('poll'), Math.max(0, delay))
  }
  const stale = () => !status.lastSuccess || Boolean(status.error) || clock.now() - status.lastSuccess >= intervalMs
  const request = (reason = 'manual') => {
    if (!available()) return Promise.resolve()
    if (inFlight) {
      if (reason !== 'poll' && !(reason === 'recovery' && inFlightReason === 'poll')) trailing = true
      refreshLog({ event: 'refresh_skipped', reason, skipped: 'in_flight' })
      return inFlight
    }
    if (reason === 'recovery' && !stale()) {
      refreshLog({ event: 'refresh_skipped', reason, skipped: 'fresh' })
      schedule(Math.max(0, intervalMs - (clock.now() - (status.lastSuccess || clock.now()))))
      return Promise.resolve()
    }
    const earliest = reason === 'manual' || reason === 'recovery' ? serverRetryAt : retryAt
    if (clock.now() < earliest) {
      refreshLog({ event: 'refresh_skipped', reason, skipped: 'cooldown', retryMs: earliest - clock.now() })
      schedule(earliest - clock.now())
      return Promise.resolve()
    }
    clearTimer()
    clock.clearTimeout(burstTimer)
    burstTimer = undefined
    controller = new AbortController()
    const signal = controller.signal
    inFlightReason = reason
    publish({ loading: true })
    refreshLog({ event: 'refresh_start', reason })
    inFlight = Promise.resolve().then(() => load(signal)).then(value => {
      if (disposed || signal.aborted) return
      onData(value)
      failures = 0
      retryAt = serverRetryAt = 0
      publish({ error: '', lastSuccess: clock.now() })
      refreshLog({ event: 'refresh_success', reason })
    }).catch(error => {
      if (disposed || signal.aborted || isAbortError(error)) {
        refreshLog({ event: 'refresh_skipped', reason, skipped: 'aborted', status: error?.status, code: error?.code })
        return
      }
      const retryAfter = Math.max(0, Number(error?.retryAfterMs) || 0)
      serverRetryAt = clock.now() + retryAfter
      const retryMs = Math.max(retryDelays[Math.min(failures++, retryDelays.length - 1)], retryAfter)
      retryAt = clock.now() + retryMs
      publish({ error: error?.message || 'Unable to refresh records. Please try again.' })
      refreshLog({
        event: 'refresh_failed', reason, status: error?.status, code: error?.code, requestId: error?.requestId, retryMs,
        authValid: error?.status !== 401
      })
    }).finally(() => {
      inFlight = undefined
      inFlightReason = ''
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
  const unbindSocket = () => {
    activeSocket?.off(event, changed)
    activeSocket?.off('connect', connected)
    activeSocket?.off('disconnect', disconnected)
    activeSocket?.off('connect_error', disconnected)
    activeSocket = undefined
  }
  const setSocket = next => {
    if (disposed) return
    if (activeSocket === next) {
      publish({ connected: Boolean(next?.connected) })
      return
    }
    unbindSocket()
    activeSocket = next || undefined
    activeSocket?.on(event, changed)
    activeSocket?.on('connect', connected)
    activeSocket?.on('disconnect', disconnected)
    activeSocket?.on('connect_error', disconnected)
    publish({ connected: Boolean(activeSocket?.connected) })
  }
  target.addEventListener?.('online', recover)
  target.addEventListener?.('offline', offline)
  documentRef?.addEventListener('visibilitychange', recover)
  setSocket(socket)
  publish({})
  request('poll')
  return {
    refresh: () => request('manual'),
    setSocket,
    dispose() {
      disposed = true
      controller?.abort()
      clearTimer()
      clock.clearTimeout(burstTimer)
      target.removeEventListener?.('online', recover)
      target.removeEventListener?.('offline', offline)
      documentRef?.removeEventListener('visibilitychange', recover)
      unbindSocket()
    }
  }
}
