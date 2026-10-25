import { useCallback, useEffect, useRef, useState } from 'react'
import { createRefreshResource } from './refreshResource.js'

const emptyStatus = { error: '', lastSuccess: null, loading: false, offline: false, connected: false }

export default function useRefreshResource({ enabled, account, load, onData, intervalMs = 15000, socket, event, refreshKey }) {
  const latest = useRef({ load, onData, account })
  latest.current = { load, onData, account }
  const resource = useRef(null)
  const previousKey = useRef(refreshKey)
  const [snapshot, setSnapshot] = useState(null)
  useEffect(() => {
    previousKey.current = refreshKey
    if (!enabled || !account) return undefined
    const current = createRefreshResource({
      load: signal => {
        if (latest.current.account !== account) throw new DOMException('Account changed', 'AbortError')
        return latest.current.load(signal)
      }, onData: value => { if (latest.current.account === account) latest.current.onData(value) },
      onStatus: status => setSnapshot({ account, status }), intervalMs, socket, event
    })
    resource.current = current
    return () => { current.dispose(); if (resource.current === current) resource.current = null }
  }, [enabled, account, intervalMs, socket, event])
  useEffect(() => {
    if (previousKey.current !== refreshKey) { previousKey.current = refreshKey; resource.current?.refresh() }
  }, [refreshKey])
  const refresh = useCallback(() => resource.current?.refresh(), [])
  const status = enabled && snapshot?.account === account ? snapshot.status : { ...emptyStatus, loading: Boolean(enabled && account) }
  return { ...status, refresh, retry: refresh }
}
