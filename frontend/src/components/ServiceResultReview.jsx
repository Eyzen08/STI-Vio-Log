import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { useActionLock } from '../lib/asyncAction.js'
import AsyncActionButton from './AsyncActionButton.jsx'
import { attendanceOutcomeLabel } from '../lib/attendanceOutcome.js'

function ServiceResultReview({ token, onChanged }) {
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [active, setActive] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const runAction = useActionLock()
  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/community-service/results/pending`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to load pending results.')
      setResults(data.results || [])
    } catch (loadError) { setError(loadError.message) }
  }, [token])
  useEffect(() => { load() }, [load])

  const review = async (event) => {
    event.preventDefault()
    return runAction('service-result-review', async () => {
      setBusy(true); setError('')
      try {
        const response = await fetch(`${API_URL}/api/community-service/results/${active.id}/review`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: active.decision, review_notes: notes.trim() }) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to review result.')
        setActive(null); setNotes(''); await load(); onChanged?.()
      } catch (reviewError) { setError(reviewError.message) }
      finally { setBusy(false) }
    })
  }

  return <section className="table-card"><div className="table-header"><div><h3>Pending department service results</h3><p>Worked time is credited only after Discipline Office approval.</p></div><span>{results.length} pending</span></div>{error&&<p className="error-message" role="alert">{error}</p>}{results.length===0?<p className="empty-state">No service results are waiting for review.</p>:<div className="registration-review-list">{results.map(item=><article key={item.id}><div className="registration-review-heading"><div><h4>{item.student_number} — {item.first_name} {item.last_name}</h4><p>{item.department_name} · {item.worked_minutes} worked minutes</p></div><span className="status-badge">{attendanceOutcomeLabel(item.service_condition)}</span></div><p>{item.result_notes||'No result note supplied.'}</p><div className="registration-review-actions"><button type="button" disabled={busy} onClick={()=>setActive({id:item.id,decision:'APPROVE'})}>Approve credit</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>setActive({id:item.id,decision:'REJECT'})}>Reject</button></div></article>)}</div>}{active&&<form className="login-form" onSubmit={review} aria-busy={busy}><label>Required review note<textarea value={notes} onChange={event=>setNotes(event.target.value)} required maxLength="1000" disabled={busy}/></label><div className="registration-review-actions"><AsyncActionButton busy={busy} busyLabel={active.decision==='APPROVE'?'Approving…':'Rejecting…'}>Confirm {active.decision.toLowerCase()}</AsyncActionButton><button type="button" className="secondary-button" disabled={busy} onClick={()=>setActive(null)}>Cancel</button></div></form>}</section>
}

export default ServiceResultReview
