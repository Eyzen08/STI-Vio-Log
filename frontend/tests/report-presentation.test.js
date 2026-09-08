import test from 'node:test'
import assert from 'node:assert/strict'
import { reportCell, presentedReportRows } from '../src/lib/reportPresentation.js'
import { createDepartmentReportCsv } from '../src/lib/departmentReports.js'

test('report presentation preserves student numbers and formats durations and states', () => {
  assert.equal(reportCell('student_number', '02000123456'), '02000123456')
  assert.equal(reportCell('remaining_hours', '1.5'), '1 hr 30 min')
  assert.equal(reportCell('credited_minutes', 90), '1 hr 30 min')
  assert.equal(reportCell('assignment_status', 'IN_PROGRESS'), 'In Progress')
  assert.equal(reportCell('remaining_hours', null), 'Not recorded')
})
test('display exports share readable cells and retain spreadsheet escaping', () => {
  const rows = presentedReportRows([{ student_name: '=SUM(1)', remaining_hours: 0.5 }])
  assert.equal(rows[0]['Remaining Hours'], '30 min')
  assert.match(createDepartmentReportCsv(rows), /'=SUM\(1\)/)
})
