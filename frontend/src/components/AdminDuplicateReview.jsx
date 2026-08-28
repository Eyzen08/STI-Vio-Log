import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { duplicateSummaryTotal, duplicateTypeLabel } from '../lib/duplicateReview.js'

function AdminDuplicateReview({ token }) {
  const [conflicts,setConflicts]=useState([]),[summary,setSummary]=useState({}),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const load=useCallback(async()=>{setLoading(true);setError('');try{const response=await fetch(`${API_URL}/api/admin/duplicate-review`,{headers:{Authorization:`Bearer ${token}`}});const data=await response.json().catch(()=>null);if(!response.ok||data?.success===false)throw new Error(data?.message||'Unable to review possible duplicates.');setConflicts(data.conflicts||[]);setSummary(data.summary||{})}catch(e){setConflicts([]);setSummary({});setError(e.message)}finally{setLoading(false)}},[token])
  useEffect(()=>{load()},[load])
  return <section className="registration-review-page" aria-labelledby="duplicate-review-title"><div className="department-welcome"><div><p className="eyebrow">System administration</p><h2 id="duplicate-review-title">Duplicate account review</h2><p>Review possible identity conflicts. This screen never merges or deletes records and never displays Google identity claims.</p></div><span className="status-badge">{duplicateSummaryTotal(summary)} conflicts</span></div>
  {error&&<p className="error-message" role="alert">{error} <button type="button" onClick={load}>Retry</button></p>}
  <section className="table-card"><div className="table-header"><h3>Possible conflicts</h3><span>Read only</span></div>{loading?<p className="empty-state" aria-live="polite">Checking account identifiers…</p>:!error&&conflicts.length===0?<div className="department-empty"><h4>No current conflicts found</h4><p>Active records and pending requests use distinct account identifiers.</p></div>:conflicts.length>0&&<div className="registration-review-list">{conflicts.map(conflict=><article key={conflict.id}><div className="registration-review-heading"><div><h4>{duplicateTypeLabel(conflict.type)}</h4><p>{conflict.identifier}</p></div><span className="status-badge">{conflict.occurrences} matches</span></div><dl>{conflict.sources.map((source,index)=><div key={`${source.source}-${source.record_id}-${index}`}><dt>{source.source_label}</dt><dd>{source.display} · Record #{source.record_id}</dd></div>)}</dl><p>Verify the school records before taking any separate, audited account action.</p></article>)}</div>}</section>
  </section>
}
export default AdminDuplicateReview
