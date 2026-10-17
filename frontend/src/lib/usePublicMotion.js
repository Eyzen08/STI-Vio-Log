import { useEffect, useState } from 'react'
import { LANDING_MOTION_KEY, normalizeLandingMotion } from './landingPreferences.js'

export default function usePublicMotion() {
  const [motionMode, setMotionMode] = useState(() => {
    try { return normalizeLandingMotion(localStorage.getItem(LANDING_MOTION_KEY)) } catch { return 'full' }
  })
  useEffect(() => {
    // Retain the original key so existing landing preferences carry into login.
    try { localStorage.setItem(LANDING_MOTION_KEY, motionMode) } catch { /* Motion remains usable without storage. */ }
  }, [motionMode])
  return [motionMode, () => setMotionMode(value => value === 'full' ? 'reduced' : 'full')]
}
