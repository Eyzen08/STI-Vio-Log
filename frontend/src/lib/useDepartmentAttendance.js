import { useState } from 'react'
import { apiRequest, ApiError } from './api.js'
import { buildDepartmentDtrQuery } from './departmentDtr.js'
import useRefreshResource from './useRefreshResource.js'

export default function useDepartmentAttendance({ token, userId, enabled, realtimeSocket, refreshKey }) {
  const account = enabled ? `${userId}:${token}` : ''
  const [filter, setFilter] = useState({ account: '', query: '' })
  const query = filter.account === account ? filter.query : ''
  const [snapshot, setSnapshot] = useState(null)
  const current = snapshot?.account === account ? snapshot : null
  const save = patch => setSnapshot(previous => ({ ...(previous?.account === account ? previous : {}), account, ...patch }))
  const options = { enabled, account, socket: realtimeSocket, refreshKey }
  const load = (path, signal) => apiRequest(path, { headers: { Authorization: `Bearer ${token}` }, signal })
  const overviewSync = useRefreshResource({ ...options, intervalMs: 60000,
    load: signal => load('/api/reports/dtr', signal), onData: overview => save({ overview }) })
  const filteredSync = useRefreshResource({ ...options, enabled: enabled && Boolean(query), account: `${account}:${query}`, intervalMs: 60000,
    load: signal => load(`/api/reports/dtr?${query}`, signal), onData: report => save({ report, reportQuery: query }) })
  const attendanceSync = useRefreshResource({ ...options,
    load: async signal => {
      const data = await load('/api/community-service/active-sessions', signal)
      if (!Array.isArray(data?.sessions)) throw new ApiError('Attendance unavailable. Last loaded status may be outdated.', { code: 'INVALID_RESPONSE' })
      return data.sessions
    }, onData: activeSessions => save({ activeSessions, attendanceReady: true }) })
  const reportSync = query ? filteredSync : overviewSync
  const refresh = () => { overviewSync.refresh(); if (query) filteredSync.refresh(); attendanceSync.refresh() }
  return {
    overview: current?.overview || null, overviewError: overviewSync.error,
    overviewLoading: Boolean(enabled && !current?.overview && overviewSync.loading),
    report: query ? current?.report || null : current?.overview || null, reportError: reportSync.error,
    reportLoading: Boolean(enabled && reportSync.loading && (query ? current?.reportQuery !== query : !current?.overview)),
    activeSessions: current?.activeSessions || [], attendanceReady: current?.attendanceReady || false,
    attendanceLoading: Boolean(enabled && !current?.attendanceReady && attendanceSync.loading), attendanceError: attendanceSync.error,
    onFilter: filters => setFilter({ account, query: buildDepartmentDtrQuery(filters) }),
    ...attendanceSync, refresh, retry: refresh, attendanceSync, reportSync
  }
}
