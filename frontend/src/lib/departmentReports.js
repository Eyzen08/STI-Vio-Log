const csvCell = (value) => {
  const text = String(value ?? '')
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export const departmentReportRows = (type, { dtr, nonCompliance } = {}) => {
  if (type === 'non-compliance') {
    return (Array.isArray(nonCompliance?.data) ? nonCompliance.data : []).map((row) => ({
      student_number: row.student_number,
      student_name: [row.first_name, row.last_name].filter(Boolean).join(' '),
      program: row.program,
      year_level: row.year_level,
      open_violations: row.open_violations,
      pending_hours: row.pending_hours,
      last_violation_date: row.last_violation_date
    }))
  }
  return (Array.isArray(dtr?.data) ? dtr.data : []).map((row) => ({
    student_number: row.student_number,
    student_name: [row.first_name, row.last_name].filter(Boolean).join(' '),
    assignment_status: row.assignment_status,
    completed_sessions: row.total_completed_sessions,
    worked_minutes: row.total_worked_minutes,
    credited_minutes: row.total_credited_minutes,
    remaining_hours: row.remaining_hours,
    latest_attendance_at: row.latest_attendance_at
  }))
}

export const createDepartmentReportCsv = (rows) => {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  return [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\r\n')
}

export const departmentReportFilename = (type, date = new Date()) => `department-${type}-${date.toISOString().slice(0, 10)}.csv`
