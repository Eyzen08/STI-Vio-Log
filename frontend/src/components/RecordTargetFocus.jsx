import { useEffect, useState } from 'react'

export default function RecordTargetFocus({ id, loading = false, error = false }) {
  const [missing, setMissing] = useState(null)
  useEffect(() => {
    if (!id || loading || error) return
    const element = document.getElementById(id)
    setMissing(element ? null : id)
    if (!element) return
    for (const details of element.querySelectorAll('details')) details.open = true
    element.scrollIntoView({ block: 'center', behavior: 'instant' })
    element.focus({ preventScroll: true })
  }, [id, loading, error])
  return id && !loading && (error || missing === id)
    ? <p className="error-message" role="alert">The requested record is unavailable or you no longer have access to it.</p>
    : null
}
