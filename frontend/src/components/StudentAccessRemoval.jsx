import { useState } from 'react'
import { API_URL } from '../lib/api.js'
import { buildGoogleRecoveryPayload } from '../lib/accountAdmin.js'

function StudentAccessRemoval({ token, student }) {
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const removeAccess = async (event) => {
    event.preventDefault()
    const cleanReason = reason.trim()
    if (!cleanReason) return setError('Enter a reason before removing access.')
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`${API_URL}/api/admin/students/${student.id}/google-link/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildGoogleRecoveryPayload(cleanReason))
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.success === false) throw new Error(data?.message || 'Unable to remove student portal access.')
      setConfirming(false)
      setReason('')
      setSuccess('Google access removed. Existing sessions are closed, and the student may link a Google account again.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  if (!confirming) return <div className="student-access-removal"><button type="button" className="danger-button" onClick={() => { setConfirming(true); setError(''); setSuccess('') }}>Remove Google access</button>{success && <p className="success-message" role="status">{success}</p>}</div>

  return <form className="student-access-removal" onSubmit={removeAccess}>
    <p><strong>Remove portal access for {student.first_name} {student.last_name}?</strong></p>
    <p>The disciplinary record will be preserved. The current Google link and signed-in sessions will be revoked.</p>
    <label>Required reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength="1000" required autoFocus /></label>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="registration-review-actions"><button type="submit" className="danger-button" disabled={busy}>{busy ? 'Removing…' : 'Confirm removal'}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => { setConfirming(false); setReason(''); setError('') }}>Cancel</button></div>
  </form>
}

export default StudentAccessRemoval
