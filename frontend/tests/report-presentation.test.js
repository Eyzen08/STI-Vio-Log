import test from 'node:test'
import assert from 'node:assert/strict'
import { reportCell, presentedReportRows } from '../src/lib/reportPresentation.js'
import { createDepartmentReportCsv } from '../src/lib/departmentReports.js'
import * as presentation from '../src/lib/reportPresentation.js'

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

test('report schemas explain all seven reports without raw identifiers or avatars', () => {
  assert.equal(typeof presentation.reportColumns, 'function')
  for (const type of ['violations','community-service','dtr','non-compliance','parent-contacts','clearance','good-standing']) {
    const keys = presentation.reportColumns(type).map(column => column.key)
    assert.ok(keys.includes('student_name')); assert.ok(keys.includes('student_number'))
    assert.ok(!keys.some(key => key === 'avatar' || key.endsWith('_id')))
  }
  const row = presentation.reportValues('violations', { first_name:'Maria',last_name:'Santos',student_number:'000123',description:'Handbook offense: No ID\nIncident details: Arrived without ID\nSecond line',status:'OPEN' })
  assert.equal(row.student_name, 'Maria Santos'); assert.equal(row.student_number, '000123')
  assert.equal(row.handbook_offense, 'No ID'); assert.equal(row.incident_details, 'Arrived without ID\nSecond line')
  assert.equal(presentation.reportValues('violations',{description:'Legacy incident'}).incident_details, 'Legacy incident')
  assert.equal(presentation.reportValues('clearance',{has_active_violation:false}).has_active_violation, false)
  assert.equal(presentation.reportValues('dtr',{total_credited_minutes:0}).total_credited_minutes, 0)
})
