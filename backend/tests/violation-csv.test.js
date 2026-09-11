const test = require('node:test')
const assert = require('node:assert/strict')
const reportRoutes = require('../src/routes/reportRoutes')
const { violationCsv, violationQuery, createViolationWorkbook } = require('../src/controllers/reportController')

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
  assert.ok(routes.includes('/violations.xlsx'))
  assert.ok(routes.indexOf('/violations.csv') < routes.indexOf('/violations'))
  assert.ok(routes.indexOf('/violations.xlsx') < routes.indexOf('/violations'))
  })

test('violations Excel export mirrors the readable generated report layout', async () => {
  const workbook = createViolationWorkbook([{
    first_name: 'Maria', last_name: 'Santos', student_number: '02000123456',
    violation_name: 'Major Offense - Category A', incident_date: '2026-09-11',
    status: 'IN_PROGRESS', description: 'A long incident description that should wrap inside the cell.'
  }])
  const sheet = workbook.getWorksheet('Violation Report')
  assert.deepEqual(sheet.getRow(1).values.slice(1), ['First Name', 'Last Name', 'Student Number', 'Violation Name', 'Incident Date', 'Status', 'Description'])
  assert.equal(sheet.getCell('C2').value, '02000123456')
  assert.equal(sheet.getCell('E2').value, 'Sep 11, 2026')
  assert.equal(sheet.getCell('F2').value, 'In Progress')
  assert.equal(sheet.getColumn('description').width, 80)
  assert.equal(sheet.getCell('G2').alignment.wrapText, true)
  assert.equal(sheet.views[0].state, 'frozen')
  const buffer = await workbook.xlsx.writeBuffer()
  assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), 'PK')
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
