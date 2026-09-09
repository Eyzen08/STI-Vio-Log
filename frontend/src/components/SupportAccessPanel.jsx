import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { formatManilaDateTime } from '../lib/displayFormat.js'

const SCOPES=[
  ['REPORT_VIEW','Reports'],
  ['STUDENT_BASIC_VIEW','Basic student records'],
  ['STUDENT_RESTRICTED_VIEW','Restricted student records'],
  ['GUARDIAN_CONTACT_VIEW','Guardian contacts'],
  ['PRIVATE_MESSAGES_VIEW','Private messages'],
  ['OPERATIONAL_AUDIT_VIEW','Operational audit']
]

const readError=async(response)=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error?.message||data.message||'Support-access operation failed.');return data}

export default function SupportAccessPanel({token,role}){
  const isSystem=role==='SYSTEM_ADMIN'
  const [requests,setRequests]=useState([])
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [form,setForm]=useState({reason:'',affected_module:'',scopes:[],duration_minutes:'30',ticket_reference:''})

  const load=useCallback(async()=>{try{setError('');const response=await fetch(`${API_URL}/api/support-access`,{headers:{Authorization:`Bearer ${token}`}});const data=await readError(response);setRequests(data.requests||[])}catch(loadError){setError(loadError.message)}},[token])
  useEffect(()=>{load()},[load])

  const submit=async(event)=>{
    event.preventDefault();setBusy(true);setError('');setNotice('')
    try{const response=await fetch(`${API_URL}/api/support-access`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...form,duration_minutes:Number(form.duration_minutes),read_only:true})});await readError(response);setForm({reason:'',affected_module:'',scopes:[],duration_minutes:'30',ticket_reference:''});setNotice('Support-access request submitted for independent approval.');await load()}catch(actionError){setError(actionError.message)}finally{setBusy(false)}
  }
  const decide=async(request,approve)=>{
    const reason=window.prompt(`${approve?'Approve':'Reject'} request #${request.id}: enter the decision reason`)
    if(!reason)return
    setBusy(true);setError('')
    try{const response=await fetch(`${API_URL}/api/support-access/${request.id}/decision`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({approve,scopes:approve?request.requested_scopes:[],reason})});await readError(response);await load()}catch(actionError){setError(actionError.message)}finally{setBusy(false)}
  }
  const revoke=async(request)=>{
    const reason=window.prompt(`Revoke request #${request.id}: enter the reason`);if(!reason)return
    setBusy(true);setError('')
    try{const response=await fetch(`${API_URL}/api/support-access/${request.id}/revoke`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({reason})});await readError(response);await load()}catch(actionError){setError(actionError.message)}finally{setBusy(false)}
  }
  const toggle=(scope)=>setForm((current)=>({...current,scopes:current.scopes.includes(scope)?current.scopes.filter((item)=>item!==scope):[...current.scopes,scope]}))

  return <section className="system-dashboard support-access-page">
    <header className="management-page-header"><div><span className="page-breadcrumb">Security / Temporary access</span><h2>{isSystem?'Request support access':'Support-access approvals'}</h2><p>{isSystem?'Request exact, time-limited read-only access. A different Discipline Administrator must approve it.':'Review technical-support requests using least privilege and separation of duties.'}</p></div><span className="status-badge">{requests.length} requests</span></header>
    {error&&<p className="error-message" role="alert">{error}</p>}{notice&&<p className="success-message" role="status">{notice}</p>}
    {isSystem&&<form className="table-card support-request-form" onSubmit={submit}><div className="table-header"><div><h3>New read-only request</h3><p>Write access is intentionally unavailable.</p></div></div><div className="form-grid"><label><span>Affected module</span><input required maxLength="100" value={form.affected_module} onChange={(e)=>setForm({...form,affected_module:e.target.value})}/></label><label><span>Duration</span><select value={form.duration_minutes} onChange={(e)=>setForm({...form,duration_minutes:e.target.value})}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="480">8 hours</option></select></label><label><span>Ticket/reference (optional)</span><input maxLength="100" value={form.ticket_reference} onChange={(e)=>setForm({...form,ticket_reference:e.target.value})}/></label><label className="full-width"><span>Reason</span><textarea required minLength="10" maxLength="1000" value={form.reason} onChange={(e)=>setForm({...form,reason:e.target.value})}/></label></div><fieldset><legend>Exact requested scopes</legend><div className="support-scope-grid">{SCOPES.map(([value,label])=><label key={value}><input type="checkbox" checked={form.scopes.includes(value)} onChange={()=>toggle(value)}/><span>{label}</span></label>)}</div></fieldset><button disabled={busy||!form.scopes.length}>{busy?'Submitting…':'Submit for approval'}</button></form>}
    <section className="table-card"><div className="table-header"><div><h3>{isSystem?'Request history':'Approval queue and history'}</h3><p>Current database status is checked whenever protected access is attempted.</p></div></div><div className="table-wrap"><table><thead><tr><th>Request</th><th>Module and scope</th><th>Duration</th><th>Status</th><th>Decision / expiry</th><th>Actions</th></tr></thead><tbody>{requests.map((request)=><tr key={request.id}><td><strong>#{request.id}</strong><br/><small>{formatManilaDateTime(request.created_at)}</small></td><td><strong>{request.affected_module}</strong><br/><small>{request.requested_scopes?.join(', ')}</small><br/><small>{request.reason}</small></td><td>{request.requested_duration_minutes} min<br/><small>Read-only</small></td><td><span className="status-badge">{request.status}</span></td><td>{request.expires_at?formatManilaDateTime(request.expires_at):request.decision_reason||'Awaiting review'}</td><td>{!isSystem&&request.status==='PENDING'&&<div className="action-row"><button type="button" disabled={busy} onClick={()=>decide(request,true)}>Approve exact scopes</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>decide(request,false)}>Reject</button></div>}{request.status==='APPROVED'&&<button type="button" className="danger-button" disabled={busy} onClick={()=>revoke(request)}>Revoke</button>}</td></tr>)}{!requests.length&&<tr><td colSpan="6"><p className="empty-state">No support-access requests.</p></td></tr>}</tbody></table></div></section>
  </section>
}
