const test = require('node:test')
const assert = require('node:assert/strict')
const reportRoutes = require('../src/routes/reportRoutes')
const { violationCsv, violationQuery } = require('../src/controllers/reportController')

test('violations CSV has the exact required headers and safely quotes values', () => {
  const csv = violationCsv([{
    first_name: '=Malicious', last_name: 'Dela "Cruz"', student_number: '02000123456',
    violation_name: 'Late, submission', incident_date: '2026-09-08', status: 'OPEN', description: 'Line one\nLine two'
  }])
  assert.ok(csv.startsWith('\uFEFFFIRST NAME,LAST NAME,STUDENT NUMBER,VIOLATION NAME,INCIDENT DATE,STATUS,DESCRIPTION\r\n'))
  assert.match(csv, /"'=Malicious"/)
  assert.match(csv, /"Dela ""Cruz"""/)
  assert.match(csv, /"Late, submission"/)
  assert.match(csv, /"2026-09-08"/)
})

test('violations CSV export is protected and registered before the parameter route', () => {
  const routes = reportRoutes.stack.filter((layer) => layer.route).map((layer) => layer.route.path)
  assert.ok(routes.includes('/violations.csv'))
  assert.ok(routes.indexOf('/violations.csv') < routes.indexOf('/violations'))
  })

test('screen and CSV reports share parameterized filters and sorting', () => {
  const { query, params } = violationQuery({
    status: 'OPEN', student_id: '12', from_date: '2026-09-01', to_date: '2026-09-08',
    search: 'Dela Cruz', sort_by: 'status'
  })
  assert.deepEqual(params, ['OPEN', '12', '2026-09-01', '2026-09-08', '%Dela Cruz%'])
  assert.match(query, /s\.student_number ILIKE \$5/)
  assert.match(query, /ORDER BY v\.status,v\.incident_date DESC/)
  assert.doesNotMatch(query, /Dela Cruz/)
})
