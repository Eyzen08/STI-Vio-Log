import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { formatManilaDate, formatManilaDateTime } from '../lib/displayFormat.js'
import Modal from './Modal.jsx'

const fullName = (item) => [item.first_name,item.middle_name,item.last_name,item.suffix].filter(Boolean).join(' ')
const statuses = ['PENDING','APPROVED','REJECTED']

function GoogleRegistrationReview({ token, onPendingCountChange }) {
  const [registrations,setRegistrations] = useState([])
  const [selected,setSelected] = useState(null)
  const [queueStatus,setQueueStatus] = useState('PENDING')
  const [search,setSearch] = useState('')
  const [flagFilter,setFlagFilter] = useState('ALL')
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [reasonById,setReasonById] = useState({})
  const [busyId,setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response=await fetch(`${API_URL}/api/google-registrations?status=${queueStatus}&limit=100`,{headers:{Authorization:`Bearer ${token}`}})
      const data=await response.json().catch(()=>null)
      if(!response.ok||data?.success===false)throw new Error(data?.message||'Unable to load registration requests.')
      setRegistrations(Array.isArray(data.registrations)?data.registrations:[])
    }catch(loadError){setError(loadError.message)}finally{setLoading(false)}
  },[token,queueStatus])

  useEffect(()=>{load()},[load])
  useEffect(()=>{if(queueStatus==='PENDING')onPendingCountChange?.(registrations.length)},[registrations.length,onPendingCountChange,queueStatus])

  const review=async(registration,decision)=>{
    const reason=String(reasonById[registration.id]||'').trim()
    if(!reason)return setError('Enter a review reason before approving or requesting a correction.')
    setBusyId(registration.id);setError('')
    try{
      const response=await fetch(`${API_URL}/api/google-registrations/${registration.id}/${decision}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({reason})})
      const data=await response.json().catch(()=>null)
      if(!response.ok||data?.success===false)throw new Error(data?.message||'Unable to review this registration.')
      setRegistrations((current)=>current.filter((item)=>item.id!==registration.id));setSelected(null)
    }catch(reviewError){setError(reviewError.message)}finally{setBusyId(null)}
  }

  const visible=useMemo(()=>registrations.filter((item)=>{
    const query=search.trim().toLowerCase()
    const matchesSearch=!query||[fullName(item),item.student_number,item.google_email,item.program,item.section,item.guardian_name].filter(Boolean).join(' ').toLowerCase().includes(query)
    return matchesSearch&&(flagFilter==='ALL'||item.review_flag===flagFilter)
  }),[registrations,search,flagFilter])
  const duplicateCount=registrations.filter((item)=>item.review_flag==='POTENTIAL_DUPLICATE').length
  const linkedCount=registrations.filter((item)=>item.google_linked).length

  return <section className="registration-management" aria-labelledby="registration-review-title">
    <header className="management-page-header"><div><span className="page-breadcrumb">Home / Registration Review</span><h2 id="registration-review-title">Registration Review</h2><p>Validate student identity, official-record matching, and account-link status before granting access.</p></div><span className="readonly-badge">Secure identity review</span></header>
    <section className="management-metrics" aria-label="Registration review summary"><article className="management-metric metric-orange"><i>!</i><div><strong>{registrations.length}</strong><span>{queueStatus.replaceAll('_',' ')}</span></div></article><article className="management-metric metric-red"><i>!</i><div><strong>{duplicateCount}</strong><span>Potential Duplicates</span></div></article><article className="management-metric metric-green"><i>✓</i><div><strong>{linkedCount}</strong><span>Google Accounts Linked</span></div></article><article className="management-metric metric-blue"><i>@</i><div><strong>{registrations.length}</strong><span>Google Verified</span></div></article></section>
    {error&&<p className="error-message" role="alert">{error}</p>}
    <section className="table-card registration-directory">
      <div className="table-header management-table-header"><div><h3>Registration Review Queue</h3><p>Pending decisions and immutable approval or rejection history.</p></div><span>{visible.length} requests</span></div>
      <div className="directory-toolbar registration-toolbar"><div className="segmented-control" role="group" aria-label="Registration status">{statuses.map((status)=><button type="button" key={status} className={queueStatus===status?'active':''} aria-pressed={queueStatus===status} onClick={()=>{setSelected(null);setQueueStatus(status)}}>{status[0]+status.slice(1).toLowerCase()}</button>)}</div><input type="search" aria-label="Search registration review" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search name, student number, email, program, or guardian…"/><select aria-label="Filter registration review flags" value={flagFilter} onChange={(event)=>setFlagFilter(event.target.value)}><option value="ALL">All review flags</option><option value="POTENTIAL_DUPLICATE">Potential duplicate</option><option value="MANUAL_RECORD_MATCH">Manual record match</option></select></div>
      {loading?<p className="empty-state" aria-live="polite">Loading registration review…</p>:visible.length===0?<div className="department-empty"><h4>No matching registrations</h4><p>Try another status or filter.</p></div>:<div className="table-wrap"><table><thead><tr><th>Student</th><th>Student Number</th><th>Academic Details</th><th>Email Verification</th><th>Google Link</th><th>Review Flag</th><th>Submitted</th><th>Action</th></tr></thead><tbody>{visible.map((item)=><tr key={item.id}><td><strong>{fullName(item)}</strong><small>{item.google_email||'Email unavailable'}</small></td><td>{item.student_number}</td><td>{item.program||'—'} · Year {item.year_level||'—'} · {item.section||'—'}</td><td><span className="status-badge">Google verified</span></td><td><span className="status-badge">{item.google_linked?'Linked':'Not linked'}</span></td><td><span className={`status-badge ${item.review_flag==='POTENTIAL_DUPLICATE'?'status-open':''}`}>{item.review_flag==='POTENTIAL_DUPLICATE'?'Potential duplicate':'Manual match'}</span></td><td>{formatManilaDate(item.created_at)}</td><td><button type="button" className="primary-row-action" onClick={()=>{setError('');setSelected(item)}}>{queueStatus==='PENDING'?'Review':'View history'}</button></td></tr>)}</tbody></table></div>}
    </section>
    {selected&&<Modal title={`Registration review — ${selected.student_number}`} drawer onClose={()=>!busyId&&setSelected(null)}><div className="registration-review-drawer"><header><span className="profile-initials">{selected.first_name?.[0]}{selected.last_name?.[0]}</span><div><h3>{fullName(selected)}</h3><p>{selected.student_number}</p><mark>{selected.status}</mark></div></header><dl><div><dt>Google account</dt><dd>{selected.google_email||'Verified identity; email unavailable'}</dd></div><div><dt>Email verification</dt><dd>Verified by Google authentication</dd></div><div><dt>Google linkage</dt><dd>{selected.google_linked?'Linked':'Not yet linked'}</dd></div><div><dt>Official-record review</dt><dd>{selected.review_flag==='POTENTIAL_DUPLICATE'?'Potential duplicate student number or email':'Manual record matching required'}</dd></div><div><dt>Student phone</dt><dd>{selected.phone_number||'Not provided'}</dd></div><div><dt>Academic details</dt><dd>{selected.program||'—'} · Year {selected.year_level||'—'} · {selected.section||'—'}</dd></div><div><dt>Guardian Contact</dt><dd>{selected.guardian_name||'Not provided'}{selected.guardian_relationship?` (${selected.guardian_relationship})`:''} · {selected.guardian_phone_number||'No phone'}</dd></div><div><dt>Submitted</dt><dd>{formatManilaDateTime(selected.created_at)}</dd></div>{selected.reviewed_at&&<div><dt>Reviewed</dt><dd>{formatManilaDateTime(selected.reviewed_at)}</dd></div>}{selected.review_reason&&<div><dt>Audit reason</dt><dd>{selected.review_reason}</dd></div>}</dl>{selected.status==='PENDING'&&<><label>Required review note<textarea value={reasonById[selected.id]||''} onChange={(event)=>setReasonById({...reasonById,[selected.id]:event.target.value})} placeholder="Document the official-record check, mismatch, or correction required" maxLength="1000" disabled={busyId===selected.id}/></label>{error&&<p className="error-message" role="alert">{error}</p>}<div className="drawer-action-row"><button type="button" className="danger-button" onClick={()=>review(selected,'reject')} disabled={busyId===selected.id}>Reject / Request Correction</button><button type="button" onClick={()=>review(selected,'approve')} disabled={busyId===selected.id}>{busyId===selected.id?'Saving…':'Approve Student Access'}</button></div></>}</div></Modal>}
  </section>
}

export default GoogleRegistrationReview
