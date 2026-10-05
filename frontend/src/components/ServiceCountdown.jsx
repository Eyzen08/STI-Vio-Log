import { formatLiveServiceTime, serviceSessionTiming } from '../lib/departmentService.js'

export default function ServiceCountdown({ session, now, className }) {
  const timing = serviceSessionTiming(session, now)
  return <>
    {timing.remainingSeconds === null ? <span className={className}>Time unavailable</span> :
      <time className={className} dateTime={`PT${timing.remainingSeconds}S`} aria-label="Remaining session time">{formatLiveServiceTime(timing.remainingSeconds)}</time>}
    {timing.limitReached && <small className="timer-limit-notice">Service limit reached — Time Out required</small>}
  </>
}
