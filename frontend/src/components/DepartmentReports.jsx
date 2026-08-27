import { useMemo, useState } from 'react'
import { createDepartmentReportCsv, departmentReportFilename, departmentReportRows } from '../lib/departmentReports.js'

const reportDescriptions = {
  dtr: 'Assignment-level attendance totals recorded by your department.',
  'non-compliance': 'Students served by your department who retain open requirements.'
}

function DepartmentReports({ dtr, nonCompliance, loading, error }) {
  const [type, setType] = useState('dtr')
  const rows = useMemo(() => departmentReportRows(type, { dtr, nonCompliance }), [type, dtr, nonCompliance])

  const download = () => {
    const csv = createDepartmentReportCsv(rows)
    if (!csv) return
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = departmentReportFilename(type)
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <div className="department-reports-page">
    <section className="department-welcome"><div><p className="eyebrow">Operational exports</p><h2>Department reports</h2><p>Review and export data already restricted to your authenticated department.</p></div></section>
    {error && <p className="error-message dashboard-error" role="alert">{error}</p>}
    <section className="report-selector" aria-label="Choose report type"><button type="button" className={type === 'dtr' ? 'active' : ''} onClick={() => setType('dtr')}>DTR summary</button><button type="button" className={type === 'non-compliance' ? 'active' : ''} onClick={() => setType('non-compliance')}>Non-compliance</button></section>
    <section className="table-card" aria-busy={loading}><div className="table-header"><div><p className="eyebrow">{type === 'dtr' ? 'Attendance report' : 'Follow-up report'}</p><h3>{type === 'dtr' ? 'Department DTR summary' : 'Non-compliance summary'}</h3><p className="report-description">{reportDescriptions[type]}</p></div><button type="button" onClick={download} disabled={loading || rows.length === 0}>Export CSV</button></div>
      {loading ? <div className="department-empty" aria-live="polite"><p>Preparing report…</p></div> : rows.length === 0 ? <div className="department-empty"><h4>No report data available</h4><p>There are no scoped records to export for this report.</p></div> : <div className="table-wrap"><table><thead><tr>{Object.keys(rows[0]).map((header) => <th key={header}>{header.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${type}-${row.assignment_id || row.student_number}-${index}`}>{Object.keys(rows[0]).map((header) => <td key={header}>{row[header] ?? '—'}</td>)}</tr>)}</tbody></table></div>}
    </section><p className="scope-note">Exports contain only the currently loaded, backend-scoped report data. Guardian and global student-directory fields are excluded.</p>
  </div>
}
export default DepartmentReports
