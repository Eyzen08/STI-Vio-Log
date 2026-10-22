const amount = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

export const summarizeDepartmentService = (assignments = []) => ({
  total: assignments.length,
  active: assignments.filter((item) => ['OPEN', 'IN_PROGRESS'].includes(item.status) && amount(item.remaining_hours) > 0).length,
  completed: assignments.filter((item) => item.status === 'COMPLETED').length,
  remainingHours: assignments.reduce((sum, item) => sum + amount(item.remaining_hours), 0)
})

export const filterDepartmentService = (assignments, query = '', status = 'ALL') => {
  const term = query.trim().toLowerCase()
  return assignments.filter((item) => {
    const text = `${item.first_name || ''} ${item.last_name || ''} ${item.student_number || ''}`.toLowerCase()
    return (!term || text.includes(term)) && (status === 'ALL' || (status === 'ACTIVE' ? ['OPEN', 'IN_PROGRESS'].includes(item.status) : item.status === status))
  })
}

export const serviceProgress = (assignment) => {
  const required = amount(assignment.required_hours)
  const completed = amount(assignment.completed_hours)
  return required > 0 ? Math.min(100, Math.max(0, Math.round((completed / required) * 100))) : 100
}

export const liveServiceSeconds = (timeIn, now = Date.now(), timerLimitSeconds = null) => {
  const startedAt = new Date(timeIn).getTime()
  const current = Number(now)
  if (!Number.isFinite(startedAt) || !Number.isFinite(current)) return 0
  const elapsed = Math.max(0, Math.floor((current - startedAt) / 1000))
  const limit = Number(timerLimitSeconds)
  return timerLimitSeconds === null || timerLimitSeconds === undefined || !Number.isFinite(limit)
    ? elapsed
    : Math.min(elapsed, Math.max(0, Math.floor(limit)))
}

export const serviceSessionTiming = (session, now = Date.now()) => {
  if (session?.session_type && session?.credit_cutoff_at) {
    const started = new Date(session.time_in).getTime()
    const cutoff = new Date(session.credit_cutoff_at).getTime()
    const current = session.time_out ? new Date(session.time_out).getTime() : Number(now)
    const pausedAt = session.paused_at ? new Date(session.paused_at).getTime() : null
    const finishedPauses = Math.max(0, Number(session.paused_seconds) || 0)
    const netUntil = (end) => {
      const pauses = Array.isArray(session.pause_history) && session.pause_history.length
        ? session.pause_history.reduce((total, pause) => total + Math.max(0, (Math.min(end, pause.ended_at ? new Date(pause.ended_at).getTime() : end) - Math.max(started, new Date(pause.started_at).getTime())) / 1000), 0)
        : finishedPauses + (pausedAt === null ? 0 : Math.max(0, (end - pausedAt) / 1000))
      return Math.max(0, (end - started) / 1000 - pauses)
    }
    const anchor = new Date(session.server_time).getTime()
    const increment = pausedAt !== null || session.time_out ? 0 : Math.max(0, (current - anchor) / 1000)
    const actual = Number.isFinite(anchor) && session.actual_elapsed_seconds != null
      ? Math.max(0, Number(session.actual_elapsed_seconds) + increment) : netUntil(current)
    const budget = session.credit_limit_seconds == null ? netUntil(cutoff) : Math.max(0, Number(session.credit_limit_seconds))
    const dayEnd = session.day_ends_at ? new Date(session.day_ends_at).getTime() : Infinity
    const eligible = Math.max(0, Math.min(actual, budget, netUntil(Math.min(current, dayEnd))))
    const target = session.session_type==='FIXED' ? Number(session.selected_duration_minutes)*60 : null
    const targetCompleted = target!==null && eligible+0.001>=target
    return { elapsedSeconds:Math.floor(eligible), actualElapsedSeconds:Math.floor(actual), pausedSeconds:Math.floor(finishedPauses + (pausedAt === null ? 0 : Math.max(0,(current-pausedAt)/1000))), timerLimitSeconds:target,
      remainingSeconds:target===null ? null : targetCompleted ? 0 : Math.max(0,Math.ceil(target-eligible)),
      targetCompleted, additionalSeconds:target===null ? 0 : Math.max(0,Math.floor(eligible-target)),
      dailyRemainingSeconds:Math.max(0,Math.ceil((480-Number(session.completed_today_minutes||0))*60-eligible)),
      creditRemainingSeconds:Math.max(0,Math.ceil(Math.min(budget-eligible,(dayEnd-current)/1000))),limitReached:eligible>=budget || current>=dayEnd }
  }
  const suppliedLimit = session?.timer_limit_seconds ?? (session?.remaining_hours == null ? null : Number(session.remaining_hours) * 3600)
  const timerLimitSeconds = suppliedLimit == null || !Number.isFinite(Number(suppliedLimit)) ? null : Math.max(0, Math.floor(Number(suppliedLimit)))
  const elapsedSeconds = liveServiceSeconds(session?.time_in, now, timerLimitSeconds)
  const hasStart = session?.time_in != null && Number.isFinite(new Date(session.time_in).getTime())
  return {
    elapsedSeconds,
    timerLimitSeconds,
    remainingSeconds: timerLimitSeconds === null || !hasStart || !Number.isFinite(Number(now))
      ? null : Math.max(timerLimitSeconds - elapsedSeconds, 0),
    limitReached: Boolean(session?.limit_reached) || (hasStart && Number.isFinite(Number(now)) && timerLimitSeconds !== null && elapsedSeconds >= timerLimitSeconds)
  }
}

export const serverClockTime = (serverTime, receivedAt, monotonicNow) => new Date(serverTime).getTime()+Math.max(0,monotonicNow-receivedAt)

export const isActiveServiceSession = (session) => Boolean(
  session && session.status === 'ACTIVE' && !session.time_out
)

export const formatLiveServiceTime = (seconds) => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remainder = safe % 60
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':')
}
