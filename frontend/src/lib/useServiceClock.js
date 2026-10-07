import { useEffect, useMemo, useState } from 'react'
import { serverClockTime } from './departmentService.js'

export default function useServiceClock(serverTime) {
  const anchor = useMemo(() => ({time:serverTime,received:performance.now()}),[serverTime])
  const [tick,setTick] = useState(() => performance.now())
  useEffect(() => {
    if (!serverTime) return undefined
    const timer = window.setInterval(() => setTick(performance.now()),1000)
    return () => window.clearInterval(timer)
  },[serverTime])
  return serverTime ? serverClockTime(anchor.time,anchor.received,tick) : null
}
