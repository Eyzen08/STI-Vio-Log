import { useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { formatManilaDateTime } from '../lib/displayFormat.js'
import PortalIcon from './PortalIcon.jsx'

const readable = (value = '') => String(value).replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())

function SystemDashboard({ token }) {
  const [system, setSystem] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [securityEvents, setSecurityEvents] = useState([])
  const [authActivity, setAuthActivity] = useState([])
  const [accountAction, setAccountAction] = useState({ target_id:'', reason:'' })
  const [accountActionError, setAccountActionError] = useState('')
  const [temporaryCredential, setTemporaryCredential] = useState(null)
  const [accountBusy, setAccountBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch(`${API_URL}/api/system/status`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.system) throw new Error(data?.error?.message || 'System status is temporarily unavailable.')
        setSystem(data.system)
      })
      .catch((loadError) => { if (loadError.name !== 'AbortError') setError(loadError.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [token])

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`${API_URL}/api/system/security-events?limit=20`, { headers }),
      fetch(`${API_URL}/api/system/authentication-activity?limit=20`, { headers })
    ]).then(async ([eventsResponse, activityResponse]) => {
      const [eventsData, activityData] = await Promise.all([eventsResponse.json().catch(()=>({})), activityResponse.json().catch(()=>({}))])
      if (eventsResponse.ok) setSecurityEvents(eventsData.events || [])
      if (activityResponse.ok) setAuthActivity(activityData.activity || [])
    }).catch(()=>{})
  }, [token])

  const integrations = Object.entries(system?.integrations || {})
  const runAccountAction = async (kind) => {
    setAccountBusy(true);setAccountActionError('');setTemporaryCredential(null)
    try {
      const response=await fetch(`${API_URL}/api/system/accounts/${accountAction.target_id}/${kind==='lock'?'lock':'recovery'}`,{method:kind==='lock'?'PATCH':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({reason:accountAction.reason})})
      const data=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(data.error?.message||'Sensitive account action failed.')
      if(data.recovery?.temporary_password)setTemporaryCredential({username:data.recovery.account.username,password:data.recovery.temporary_password})
      setAccountAction({target_id:'',reason:''})
    }catch(actionError){setAccountActionError(actionError.message)}finally{setAccountBusy(false)}
  }
  return <section className="system-dashboard" aria-labelledby="system-dashboard-title">
    <header className="management-page-header"><div><span className="page-breadcrumb">Technical administration</span><h2 id="system-dashboard-title">System Administration</h2><p>Sanitized service health and deployment information. Institutional disciplinary records are not available in this workspace.</p></div><span className={`status-badge status-${String(system?.status || '').toLowerCase()}`}>{loading ? 'Checking…' : readable(system?.status || 'Unavailable')}</span></header>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="stats-grid">
      <article className="stat-card"><i><PortalIcon name="dashboard" /></i><div><span>Application</span><strong>{system?.application || 'STI Vio-Log'}</strong><small>{system?.environment || '—'}</small></div></article>
      <article className="stat-card"><i><PortalIcon name="reports" /></i><div><span>Version</span><strong>{system?.version || '—'}</strong><small>Sanitized deployment identifier</small></div></article>
      <article className="stat-card"><i><PortalIcon name="clearance" /></i><div><span>Database</span><strong>{readable(system?.database || (loading ? 'CHECKING' : 'UNAVAILABLE'))}</strong><small>Connectivity only; no credentials exposed</small></div></article>
    </div>
    <section className="table-card"><div className="table-header"><div><h3>Integration status</h3><p>Configuration presence only. Secret values are never returned.</p></div><span>{system?.checked_at ? formatManilaDateTime(system.checked_at) : 'Not checked'}</span></div>{integrations.length ? <div className="table-wrap"><table><thead><tr><th>Integration</th><th>Status</th></tr></thead><tbody>{integrations.map(([name, value]) => <tr key={name}><td>{readable(name)}</td><td><span className="status-badge">{readable(value)}</span></td></tr>)}</tbody></table></div> : <p className="empty-state">{loading ? 'Checking integrations…' : 'No integration status is available.'}</p>}</section>
    <section className="table-card"><div className="table-header"><div><h3>Security events</h3><p>Append-only successful, denied, and failed administrative security activity.</p></div><span>{securityEvents.length} recent</span></div><div className="table-wrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Result</th></tr></thead><tbody>{securityEvents.map((event)=><tr key={event.id}><td>{formatManilaDateTime(event.occurred_at)}</td><td>{event.actor_readable_name || 'Unauthenticated'}<br/><small>{readable(event.actor_role || 'Unknown')}</small></td><td>{readable(event.action)}</td><td>{event.target_label || event.target_type || '—'}</td><td><span className="status-badge">{event.result}</span></td></tr>)}{!securityEvents.length&&<tr><td colSpan="5"><p className="empty-state">No security events recorded.</p></td></tr>}</tbody></table></div></section>
    <section className="table-card"><div className="table-header"><div><h3>Authentication activity</h3><p>Administrator authentication and password-security activity.</p></div><span>{authActivity.length} recent</span></div><div className="table-wrap"><table><thead><tr><th>Time</th><th>Account</th><th>Action</th><th>Result</th></tr></thead><tbody>{authActivity.map((event)=><tr key={event.id}><td>{formatManilaDateTime(event.occurred_at)}</td><td>{event.actor_readable_name || event.target_label || 'Unknown account'}</td><td>{readable(event.action)}</td><td><span className="status-badge">{event.result}</span></td></tr>)}{!authActivity.length&&<tr><td colSpan="4"><p className="empty-state">No authentication activity recorded.</p></td></tr>}</tbody></table></div></section>
    <section className="table-card support-request-form"><div className="table-header"><div><h3>Account security tools</h3><p>Lock a compromised account or initiate controlled recovery. Both actions invalidate existing sessions.</p></div></div>{accountActionError&&<p className="error-message" role="alert">{accountActionError}</p>}<div className="form-grid"><label><span>Target account ID</span><input inputMode="numeric" value={accountAction.target_id} onChange={(event)=>setAccountAction({...accountAction,target_id:event.target.value.replace(/\D/g,'')})}/></label><label className="full-width"><span>Required reason</span><textarea minLength="10" maxLength="1000" value={accountAction.reason} onChange={(event)=>setAccountAction({...accountAction,reason:event.target.value})}/></label></div><div className="action-row"><button type="button" className="danger-button" disabled={accountBusy||!accountAction.target_id||accountAction.reason.trim().length<10} onClick={()=>runAccountAction('lock')}>Lock compromised account</button><button type="button" disabled={accountBusy||!accountAction.target_id||accountAction.reason.trim().length<10} onClick={()=>runAccountAction('recovery')}>Initiate recovery</button></div>{temporaryCredential&&<div className="temporary-credential" role="status"><strong>Copy this one-time credential now</strong><p>Username: <code>{temporaryCredential.username}</code></p><p>Temporary password: <code>{temporaryCredential.password}</code></p><button type="button" className="secondary-button" onClick={()=>setTemporaryCredential(null)}>I have stored it securely</button></div>}</section>
  </section>
}

export default SystemDashboard
