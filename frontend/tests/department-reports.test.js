import test from 'node:test'
import assert from 'node:assert/strict'
import { createDepartmentReportCsv, departmentReportFilename, departmentReportRows } from '../src/lib/departmentReports.js'

test('department DTR export selects only scoped operational fields', () => {
  const rows = departmentReportRows('dtr', { dtr: { data: [{ student_number: '02000123456', first_name: 'Ana', last_name: 'Reyes', assignment_id: 7, assignment_status: 'IN_PROGRESS', total_completed_sessions: 2, total_worked_minutes: 90, total_credited_minutes: 80, remaining_hours: 1, latest_attendance_at: '2026-08-28', phone_number: 'private' }] } })
  assert.equal(rows[0].student_name, 'Ana Reyes')
  assert.equal(Object.hasOwn(rows[0], 'phone_number'), false)
})

test('department report CSV escapes spreadsheet values safely', () => {
  assert.equal(createDepartmentReportCsv([{ student: 'Reyes, Ana', note: 'He said "ok"' }]), '"student","note"\r\n"Reyes, Ana","He said ""ok"""')
  assert.equal(createDepartmentReportCsv([{ student: '=HYPERLINK("bad")' }]), '"student"\r\n"\'=HYPERLINK(""bad"")"')
  assert.equal(departmentReportFilename('dtr', new Date('2026-08-28T00:00:00Z')), 'department-dtr-2026-08-28.csv')
  assert.equal(createDepartmentReportCsv([]), '')
})
