import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiRequest } from './api.js'
import { legalAccessState } from './legalPolicy.js'

export default function useLegalPolicy(userId, passwordChangeRequired) {
  const [state, setState] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => { setState(null); setAttempt(value => value + 1) }, [])
  const updateStatus = (status) => setState({ userId, status })

  useEffect(() => {
    if (!userId || passwordChangeRequired) return undefined
    const controller = new AbortController()
    apiRequest('/api/auth/legal', { signal: controller.signal })
      .then(data => {
        if (typeof data?.legal?.required !== 'boolean') throw new ApiError('Unable to verify Terms acknowledgment', { code: 'INVALID_RESPONSE' })
        if (!controller.signal.aborted) setState({ userId, status: data.legal })
      })
      .catch(error => { if (!controller.signal.aborted) setState({ userId, error: error.message }) })
    return () => controller.abort()
  }, [userId, passwordChangeRequired, attempt])

  useEffect(() => {
    window.addEventListener('sti:terms-required', retry)
    return () => window.removeEventListener('sti:terms-required', retry)
  }, [retry])

  const current = state?.userId === userId ? state : null
  return { ...legalAccessState(current, userId), status: current?.status, error: current?.error, retry, updateStatus }
}
