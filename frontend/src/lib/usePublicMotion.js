import { useEffect, useState } from 'react'

export default function usePublicMotion() {
  const [motionMode, setMotionMode] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full')
  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!preference) return undefined
    const update = () => setMotionMode(preference.matches ? 'reduced' : 'full')
    update()
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])
  return motionMode
}
