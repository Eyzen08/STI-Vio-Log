import { formatLiveServiceTime, serviceSessionTiming } from '../lib/departmentService.js'
import useServiceClock from '../lib/useServiceClock.js'
import { formatManilaTime, formatManilaDateTime } from '../lib/displayFormat.js'

export default function ServiceCountdown({ session, now, className }) {
  const serverNow = useServiceClock(session?.server_time)
  const timing = serviceSessionTiming(session, serverNow ?? now)
  const modern = Boolean(session?.session_type && session?.credit_cutoff_at)
  const open = modern && session.session_type==='OPEN_TIME'
  const shown = open ? timing.elapsedSeconds : timing.remainingSeconds
  const warning = !open && shown>0 && shown<=1800 ? shown<=300 ? 'Almost Finished' : shown<=600 ? '10 Minutes Remaining' : '30 Minutes Remaining' : ''
  return <>
    {shown===null ? <span className={className}>Time Unavailable</span> : <time className={className} dateTime={`PT${shown}S`} aria-label={open?'Time Elapsed':'Remaining Session Time'}>{formatLiveServiceTime(shown)}</time>}
    {modern && <div className="service-clock-details">
      {session.paused_at && <span>Paused Since <strong>{formatManilaDateTime(session.paused_at)}</strong></span>}
      {(session.paused_at || timing.pausedSeconds > 0) && <span>Total Paused <strong>{formatLiveServiceTime(timing.pausedSeconds)}</strong></span>}
      <span>{open?'Daily Time Remaining':'Elapsed'} <strong>{formatLiveServiceTime(open?timing.dailyRemainingSeconds:timing.elapsedSeconds)}</strong></span>
      {!open&&<><progress aria-label="Session Target Progress" value={Math.min(100,timing.elapsedSeconds/(Number(session.selected_duration_minutes)*60)*100)} max="100"/><span>Expected Completion <strong>{formatManilaTime(session.expected_completion_at||new Date(new Date(session.time_in).getTime()+Number(session.selected_duration_minutes)*60000).toISOString())}</strong></span></>}
      {!open && timing.targetCompleted && <span className="target-complete">Service Target Completed ✓{timing.additionalSeconds>0 && <> · Additional time {formatLiveServiceTime(timing.additionalSeconds)}</>}</span>}
      {warning && <small className="service-timer-warning" role="status">{shown<=300?'5 Minutes Remaining':warning}</small>}
      {!timing.limitReached && timing.dailyRemainingSeconds<=1800 && <small className="service-timer-warning">Daily Limit Approaching</small>}
      {typeof navigator!=='undefined'&&!navigator.onLine&&<small className="service-timer-warning">Offline estimate · reconnect to save Time Out.</small>}
    </div>}
    {timing.limitReached && <small className="timer-limit-notice">{modern?(session.cutoff_reason==='DAY_ENDED'?'Day Ended':timing.dailyRemainingSeconds===0?'Daily Community Service Limit Reached':'Creditable Service Limit Reached'):'Service Limit Reached'} — Time Out Required</small>}
  </>
}
