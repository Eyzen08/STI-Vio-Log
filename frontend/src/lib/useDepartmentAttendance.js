import { useEffect, useState } from 'react'
import { API_URL } from './api.js'
import { buildDepartmentDtrQuery } from './departmentDtr.js'

export default function useDepartmentAttendance({ token, userId, enabled, realtimeSocket, refreshKey, onChanged }) {
  const account = enabled ? `${userId}:${token}` : ''
  const [filter, setFilter] = useState({ account:'', query:'' })
  const query = filter.account === account ? filter.query : ''
  const [snapshot, setSnapshot] = useState(null)
  const current = snapshot?.account === account ? snapshot : null

  useEffect(() => {
    if (!account) return undefined
    const controller = new AbortController()
    const load = async (path) => {
      const response = await fetch(`${API_URL}${path}`, { headers:{Authorization:`Bearer ${token}`}, signal:controller.signal })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) throw new Error(data.message || 'Unable to load department records.')
      return data
    }
    const overview = load('/api/reports/dtr')
    const filtered = query ? load(`/api/reports/dtr?${query}`) : overview
    Promise.allSettled([overview, filtered, load('/api/community-service/active-sessions')]).then(([overviewResult, reportResult, attendanceResult]) => {
      if (controller.signal.aborted) return
      setSnapshot(previous => {
        const saved = previous?.account === account ? previous : {}
        const activeValid = attendanceResult.status === 'fulfilled' && Array.isArray(attendanceResult.value.sessions)
        return {
          ...saved, account, query, filter,
          overview:overviewResult.status === 'fulfilled' ? overviewResult.value : saved.overview,
          overviewError:overviewResult.status === 'rejected' ? overviewResult.reason.message : '',
          report:reportResult.status === 'fulfilled' ? reportResult.value : saved.report,
          reportError:reportResult.status === 'rejected' ? reportResult.reason.message : '',
          activeSessions:activeValid ? attendanceResult.value.sessions : saved.activeSessions || [],
          attendanceReady:activeValid || saved.attendanceReady || false,
          attendanceError:activeValid ? '' : attendanceResult.reason?.message || 'Attendance unavailable. Last loaded status may be outdated.'
        }
      })
    })
    return () => controller.abort()
  }, [account, token, query, filter, refreshKey])

  useEffect(() => {
    if (!account) return undefined
    const refresh = () => { if (document.visibilityState === 'visible') onChanged() }
    const timer = window.setInterval(refresh, 15000)
    document.addEventListener('visibilitychange',refresh)
    window.addEventListener('online',refresh)
    realtimeSocket?.on('community-service:changed',onChanged)
    realtimeSocket?.on('connect',onChanged)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange',refresh)
      window.removeEventListener('online',refresh)
      realtimeSocket?.off('community-service:changed',onChanged)
      realtimeSocket?.off('connect',onChanged)
    }
  }, [account, realtimeSocket, onChanged])

  return {
    overview:current?.overview || null, overviewError:current?.overviewError || '',
    overviewLoading:Boolean(enabled && !current),
    report:current?.report || null, reportError:current?.reportError || '',
    reportLoading:Boolean(enabled && (!current || current.filter !== filter)),
    activeSessions:current?.activeSessions || [], attendanceReady:current?.attendanceReady || false,
    attendanceLoading:Boolean(enabled && !current), attendanceError:current?.attendanceError || '',
    onFilter:filters => setFilter({account,query:buildDepartmentDtrQuery(filters)})
  }
}
