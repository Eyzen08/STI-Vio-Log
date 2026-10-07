import { useState } from 'react'
import ManagementMetric from './ManagementMetric.jsx'
import OffenseIndicator from './OffenseIndicator.jsx'
import PortalIcon from './PortalIcon.jsx'
import { formatDisplayLabel, formatIncidentDateTime } from '../lib/displayFormat.js'
import '../styles/violation-management.css'

const pageSize = 7

export default function ViolationManagement({ violations = [], loading = false, filters, onFiltersChange, role, onRecord, onView, onEdit }) {
  const [pagination, setPagination] = useState({ key: '', page: 1 })
  const [ascending, setAscending] = useState(false)
  const changeFilters = (next) => { setPagination({ key: '', page: 1 }); onFiltersChange(next) }
  const filterKey = JSON.stringify([filters, ascending])
  const visible = violations.filter((item) => {
    const query = filters.search.trim().toLowerCase()
    return (!query || [item.student_name, item.student_number, item.exact_offense, item.violation_name].filter(Boolean).join(' ').toLowerCase().includes(query))
      && (filters.status === 'ALL' || String(item.status).toUpperCase() === filters.status)
      && (filters.severity === 'ALL' || String(item.severity).toUpperCase().includes(filters.severity))
  }).sort((a, b) => {
    const dateOrder = String(b.incident_date || '').slice(0, 10).localeCompare(String(a.incident_date || '').slice(0, 10))
    return (dateOrder || Number(b.id) - Number(a.id)) * (ascending ? -1 : 1)
  })
  const pages = Math.max(1, Math.ceil(visible.length / pageSize))
  const page = pagination.key === filterKey ? Math.min(pagination.page, pages) : 1
  const first = (page - 1) * pageSize
  const pageStart = Math.max(1, Math.min(page - 2, pages - 4))
  const changePage = (next) => setPagination({ key: filterKey, page: next })
  const severityCount = (severity) => violations.filter((item) => String(item.severity).toUpperCase().includes(severity)).length
  const statusCount = (status) => violations.filter((item) => String(item.status).toUpperCase() === status).length
  const statuses = [...new Set(['OPEN', 'PENDING', 'COMPLETE', 'CLEAR', 'INVALID_CANCEL', ...violations.map((item) => String(item.status || '').toUpperCase()).filter(Boolean)])]

  return <section className="violation-management" aria-labelledby="violation-management-title">
    <header className="violation-page-heading">
      <div><nav aria-label="Breadcrumb">Home <span aria-hidden="true">/</span> Violations</nav><h2 id="violation-management-title">Violation Management</h2><p>Manage student violations, disciplinary progress, and service requirements.</p></div>
      <button type="button" className="violation-record-button" onClick={onRecord}><span aria-hidden="true">＋</span>Record Violation</button>
    </header>
    <section className="violation-summary-grid" aria-label="Violation summary">
      {[['Total Violations', violations.length, 'red', 'violations'], ['Minor', severityCount('MINOR'), 'orange', 'violations'], ['Major', severityCount('MAJOR'), 'red', 'violations'], ['Grave', severityCount('GRAVE'), 'purple', 'violations'], ['Open', statusCount('OPEN'), 'blue', 'reports'], ['Completed', statusCount('COMPLETE'), 'green', 'check']].map(([label, value, tone, icon]) => <ManagementMetric key={label} label={label} value={loading ? '—' : value} tone={tone} icon={icon}/>)}
    </section>
    <section className="violation-records-card" aria-labelledby="violation-records-title" aria-busy={loading}>
      <header className="violation-records-heading"><div><h3 id="violation-records-title">Violation Records</h3><p>Most recent incidents and their current status.</p></div><span>{loading ? 'Loading…' : `${visible.length} record${visible.length === 1 ? '' : 's'}`}</span></header>
      <div className="violation-toolbar">
        <label className="violation-search"><PortalIcon name="search" size={22}/><input type="search" name="violation-directory-filter" aria-label="Search violations" autoComplete="off" placeholder="Search student name, number, or offense..." value={filters.search} onChange={(event) => changeFilters({ ...filters, search: event.target.value })}/></label>
        <select aria-label="Filter violation classification" value={filters.severity} onChange={(event) => changeFilters({ ...filters, severity: event.target.value })}><option value="ALL">All classifications</option>{['MINOR', 'MAJOR', 'GRAVE'].map((severity) => <option key={severity} value={severity}>{formatDisplayLabel(severity)}</option>)}</select>
        <select aria-label="Filter violation status" value={filters.status} onChange={(event) => changeFilters({ ...filters, status: event.target.value })}><option value="ALL">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{formatDisplayLabel(status)}</option>)}</select>
      </div>
      <div className="violation-table-wrap" role="region" aria-label="Violation records" tabIndex={0}>
        <table className="violation-table">
          <colgroup><col style={{ width:'6.5%' }}/><col style={{ width:'21%' }}/><col style={{ width:'15%' }}/><col/><col style={{ width:'10.5%' }}/><col style={{ width:170 }}/><col style={{ width:180 }}/></colgroup>
          <thead><tr><th scope="col">ID</th><th scope="col">Student</th><th scope="col" aria-sort={ascending ? 'ascending' : 'descending'}><button type="button" onClick={() => { setPagination({ key: '', page: 1 }); setAscending(!ascending) }} aria-label={`Sort incident date ${ascending ? 'newest' : 'oldest'} first`}>Incident Date<PortalIcon name="chevron-right" className={ascending ? 'sort-ascending' : 'sort-descending'} size={14}/></button></th><th scope="col">Offense</th><th scope="col">Classification</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={7} className="violation-empty" role="status">Loading violation records…</td></tr> : !visible.length ? <tr><td colSpan={7} className="violation-empty">{violations.length ? 'No violations match the selected filters.' : 'No violation records yet.'}</td></tr> : visible.slice(first, first + pageSize).map((violation) => {
            const severity = String(violation.severity || '').toLowerCase()
            const status = String(violation.status || '').toLowerCase()
            const [date, time] = formatIncidentDateTime(violation.incident_date, violation.incident_time).split(/ at | · /)
            return <tr key={violation.id}>
              <td data-label="ID">#{violation.id}</td>
              <td data-label="Student"><div className="violation-student"><OffenseIndicator level={violation.offense_indicator_level} compact/><div><strong>{violation.student_name || 'Student record'}</strong><small>{violation.student_number || 'Number unavailable'}</small></div></div></td>
              <td data-label="Incident Date"><span className="violation-incident"><span>{date}</span>{time && <small>{time}</small>}</span></td>
              <td data-label="Offense"><span className="violation-offense" title={violation.exact_offense || violation.violation_name}>{violation.exact_offense || violation.violation_name || 'Not recorded'}</span></td>
              <td data-label="Classification"><span className={`violation-classification classification-${severity}`}>{formatDisplayLabel(violation.severity)}</span></td>
              <td data-label="Status"><span className={`violation-status status-${status}`}>{formatDisplayLabel(violation.status)}</span></td>
              <td data-label="Actions"><div className="violation-actions"><button type="button" aria-label={`View violation ${violation.id}`} onClick={() => onView(violation)}>View</button>{(violation.status === 'OPEN' || role === 'DISCIPLINE_ADMIN') && <button type="button" className="violation-edit-button" aria-label={`Edit violation ${violation.id}`} onClick={() => onEdit(violation)}><PortalIcon name="edit" size={18}/></button>}</div></td>
            </tr>
          })}</tbody>
        </table>
      </div>
      {visible.length > pageSize && !loading && <footer className="violation-pagination"><span aria-live="polite">Showing {first + 1}–{Math.min(first + pageSize, visible.length)} of {visible.length} records</span><nav aria-label="Violation records pagination"><button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => changePage(page - 1)}><PortalIcon name="chevron-right" className="previous-page"/></button>{Array.from({ length: Math.min(5, pages) }, (_, index) => pageStart + index).map((number) => <button type="button" key={number} aria-label={`Page ${number}`} aria-current={page === number ? 'page' : undefined} onClick={() => changePage(number)}>{number}</button>)}<button type="button" aria-label="Next page" disabled={page === pages} onClick={() => changePage(page + 1)}><PortalIcon name="chevron-right"/></button></nav></footer>}
    </section>
  </section>
}
