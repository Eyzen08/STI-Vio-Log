import { useState } from 'react'
import { API_URL } from '../lib/api.js'
import { buildAdminReportQuery, defaultReportSort, downloadReportExcel, reportFilterFields, reportSortLabel, reportSortOptions, reportStatusOptions, validateReportFilters } from '../lib/adminReports.js'
import { REPORT_TITLES, reportCell, reportColumns, reportValues, statusLabel } from '../lib/reportPresentation.js'
import { formatDisplayLabel, formatManilaDateTime } from '../lib/displayFormat.js'
import { studentIdFromSearch, studentOptionLabel } from '../lib/violationAdmin.js'
import { useActionLock } from '../lib/asyncAction.js'
import AsyncActionButton from './AsyncActionButton.jsx'
import ServiceHourCorrections from './ServiceHourCorrections.jsx'

const initialFilters = type => ({ search:'', student_id:'', status:'', from_date:'', to_date:'', sort_by:defaultReportSort(type) })

export function ReportFilters({ type, filters, students, studentSearch, onFilter, onStudent, onType, disabled = false }) {
  const fields = reportFilterFields(type)
  return <div className="student-form-grid reports-filter-grid">
    <label>Report type<select value={type} onChange={event=>onType(event.target.value)} disabled={disabled}>{Object.entries(REPORT_TITLES).map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
    {fields.includes('search') && <label>Search<input type="search" value={filters.search || ''} onChange={event=>onFilter('search',event.target.value)} placeholder="Student name, number, or classification" disabled={disabled}/></label>}
    {fields.includes('student_id') && <label>Student<input type="search" list="report-student-options" value={studentSearch} onChange={event=>onStudent(event.target.value)} placeholder="All students · search name or number" disabled={disabled} autoComplete="off"/><datalist id="report-student-options">{students.map(student=><option key={student.id} value={studentOptionLabel(student)}/>)}</datalist></label>}
    {fields.includes('status') && <label>Status<select value={filters.status || ''} onChange={event=>onFilter('status',event.target.value)} disabled={disabled}><option value="">All statuses</option>{reportStatusOptions(type).map(status=><option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>}
    {fields.includes('sort_by') && <label>Sort by<select value={filters.sort_by || defaultReportSort(type)} onChange={event=>onFilter('sort_by',event.target.value)} disabled={disabled}>{reportSortOptions(type).map(sort=><option key={sort} value={sort}>{reportSortLabel(sort)}</option>)}</select></label>}
    {fields.includes('from_date') && <><label>From date<input type="date" value={filters.from_date || ''} max={filters.to_date || undefined} onChange={event=>onFilter('from_date',event.target.value)} disabled={disabled}/></label><label>To date<input type="date" value={filters.to_date || ''} min={filters.from_date || undefined} onChange={event=>onFilter('to_date',event.target.value)} disabled={disabled}/></label></>}
  </div>
}

function ReportText({ text, label }) {
  if(text.length<=160)return <span className="report-text">{text}</span>
  return <><p className="report-text-preview">{text.slice(0,160)}…</p><details className="report-text-details"><summary>View details<span className="sr-only">: {label}</span></summary><p className="report-text">{text}</p></details></>
}

export function ReportTable({ type, rows }) {
  const columns = reportColumns(type).filter(column=>!['student_number','handbook_offense'].includes(column.key))
  return <div className="table-wrap"><table className={`responsive-record-table report-record-table report-table-${type}`}><thead><tr>{columns.map(({key,label})=><th scope="col" key={key}>{label}</th>)}</tr></thead><tbody>{rows.map((source,index)=>{
    const row = reportValues(type,source)
    return <tr key={index}>{columns.map(({key,label})=><td key={key} data-label={label} className={`report-cell-${key}`}>
      {key==='student_name' ? <><strong>{row.student_name}</strong><small className="report-student-number">{reportCell('student_number',row.student_number,source)}</small></> :
        key==='violation_name' ? <><strong>{reportCell(key,row[key],source)}</strong>{row.handbook_offense && <ReportText text={row.handbook_offense} label={`Handbook offense for ${row.student_name}`}/>}</> :
        ['status','assignment_status','standing'].includes(key) ? <span className="status-badge">{reportCell(key,row[key],source)}</span> :
        <ReportText text={reportCell(key,row[key],source)} label={`${label} for ${row.student_name}`}/>
      }
    </td>)}</tr>
  })}</tbody></table></div>
}

export default function AdminReports({ token, students = [] }) {
  const [type,setType] = useState('violations'), [filters,setFilters] = useState(()=>initialFilters('violations'))
  const [studentSearch,setStudentSearch] = useState(''), [applied,setApplied] = useState(null), [result,setResult] = useState(null)
  const [page,setPage] = useState(1), [busy,setBusy] = useState(''), [error,setError] = useState(''), [exportError,setExportError] = useState(''), [status,setStatus] = useState('')
  const runAction = useActionLock()
  const rows = result?.data || [], fields = reportFilterFields(type)
  const dirty = Boolean(applied && (applied.type!==type || buildAdminReportQuery(type,filters)!==buildAdminReportQuery(applied.type,applied.filters) || (studentSearch.trim() && !filters.student_id)))
  const generate = () => runAction('reports',async()=>{
    if(busy)return
    const validation = validateReportFilters(type,filters) || (fields.includes('student_id') && studentSearch.trim() && !filters.student_id ? 'Choose a student from the suggested names and numbers, or clear Student for all students.' : '')
    if(validation){setError(validation);return}
    const requested = {type,filters:{...filters}}
    setBusy('generate');setError('');setExportError('');setStatus('');setPage(1)
    try {
      const query = buildAdminReportQuery(requested.type,requested.filters)
      const response = await fetch(`${API_URL}/api/reports/${requested.type}${query?`?${query}`:''}`,{headers:{Authorization:`Bearer ${token}`}})
      const payload = await response.json().catch(()=>null)
      if(!response.ok || !payload?.success || !Array.isArray(payload.data))throw new Error(payload?.error?.message || payload?.message || 'Unable to generate this report. Please try again.')
      setResult(payload);setApplied(requested)
    } catch(generateError){setError(generateError.message);setResult(null);setApplied(null)} finally {setBusy('')}
  })
  const exportExcel = () => runAction('reports',async()=>{
    if(busy || !applied || !rows.length || error)return
    setBusy('export');setExportError('');setStatus('')
    try {await downloadReportExcel(applied.type,applied.filters,token);setStatus('Excel generated. Your download has started.')} catch(downloadError){setExportError(downloadError.message)} finally {setBusy('')}
  })
  const reset = nextType => {setType(nextType);setFilters(initialFilters(nextType));setStudentSearch('');setApplied(null);setResult(null);setPage(1);setError('');setExportError('');setStatus('')}
  const filterSummary = applied ? reportFilterFields(applied.type).filter(key=>applied.filters[key]).map(key=>{
    const value = applied.filters[key]
    return key==='student_id' ? `Student: ${studentOptionLabel(students.find(student=>String(student.id)===String(value)) || {}) || `#${value}`}` : `${formatDisplayLabel(key)}: ${key==='sort_by'?reportSortLabel(value):key==='status'?statusLabel(value):value}`
  }) : []
  return <section className="reports-workspace">
    <header className="management-page-header portal-page-header"><div><span className="page-breadcrumb">Home / Reports</span><h2>Reports</h2><p>Review student discipline, service, attendance, guardian contact, and clearance records.</p></div></header>
    <section className="table-card report-filter-card" aria-label="Report filters"><form className="student-form" onSubmit={event=>{event.preventDefault();generate()}}>
      <ReportFilters type={type} filters={filters} students={students} studentSearch={studentSearch} onType={reset} disabled={Boolean(busy)} onFilter={(key,value)=>{setFilters(current=>({...current,[key]:value}));setError('')}} onStudent={value=>{setStudentSearch(value);setFilters(current=>({...current,student_id:studentIdFromSearch(students,value)}));setError('')}}/>
      <div className="report-filter-actions">{fields.includes('from_date')&&<span className="report-date-note">Dates use Manila time.</span>}<AsyncActionButton type="submit" className="primary-action" busy={busy==='generate'} busyLabel="Generating report…" disabled={busy==='export'}>Generate Report</AsyncActionButton><button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={()=>reset(type)}>Clear</button></div>
    </form></section>
    {error && <p className="error-message" role="alert">{error} <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={generate}>Retry report</button></p>}
    {dirty && <p className="report-change-note" role="status">Filters changed. Generate again to update results.</p>}
    <section className="table-card report-results-card" aria-busy={busy==='generate'}><div className="table-header management-table-header"><div><h3>{applied?REPORT_TITLES[applied.type]:'Generated Report'}</h3><p>{applied?`${rows.length} records · ${rows.length?`${(page-1)*50+1}–${Math.min(page*50,rows.length)} shown`:'0 shown'} · Generated ${formatManilaDateTime(result.generated_at)} · Manila`:'Choose a report and generate results.'}</p></div><AsyncActionButton type="button" className="primary-action" busy={busy==='export'} busyLabel="Generating Excel…" disabled={Boolean(busy==='generate'||!applied||!rows.length||error)} onClick={exportExcel} aria-describedby="report-export-scope">Export Excel</AsyncActionButton></div>
      <p id="report-export-scope" className="report-export-note">Exports all results using the last generated filters. Downloads use the latest matching records.</p>
      <p className="report-export-note" role="status">{status}</p>
      {exportError&&<p className="error-message" role="alert">{exportError} <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={exportExcel}>Retry Excel export</button></p>}
      {filterSummary.length>0&&<div className="report-applied-filters" aria-label="Generated report filters">{filterSummary.map(label=><span key={label}>{label}</span>)}</div>}
      {busy==='generate'?<p className="empty-state" role="status">Generating your report…</p>:!applied?<p className="empty-state">Choose filters and generate a report to see results.</p>:!rows.length?<p className="empty-state">No records match these filters. Try another selection.</p>:<ReportTable type={applied.type} rows={rows.slice((page-1)*50,page*50)}/>}
      {applied?.type==='dtr'&&busy!=='generate'&&<ServiceHourCorrections corrections={result.hourCorrections || []}/>}
      {rows.length>50&&<nav className="report-pagination" aria-label="Report result pages"><button type="button" className="secondary-button" disabled={Boolean(busy)||page===1} onClick={()=>setPage(value=>value-1)}>Previous</button><span role="status">Page {page} of {Math.ceil(rows.length/50)} · {rows.length} records</span><button type="button" className="secondary-button" disabled={Boolean(busy)||page>=Math.ceil(rows.length/50)} onClick={()=>setPage(value=>value+1)}>Next</button></nav>}
    </section>
  </section>
}
