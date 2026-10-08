import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

test('canonical page and navigation names keep approved capitalization', () => {
  const routes = source('lib/routes.js')
  const departmentDtr = source('components/DepartmentDtr.jsx')

  for (const label of ['Community Service', 'Account Settings', 'Assigned Students', 'Audit Log', 'QR Scan']) {
    assert.match(routes, new RegExp(`label: '${label}'`))
  }
  assert.match(source('components/StudentManagement.jsx'), /<h2 id="student-management-title">Student Management<\/h2>/)
  assert.match(source('components/ViolationManagement.jsx'), /<h2 id="violation-management-title">Violation Management<\/h2>/)
  assert.match(departmentDtr, /<h2>Daily Time Record<\/h2>/)
  assert.doesNotMatch(departmentDtr, />Daily time record</)
})

test('compact student labels and account actions retain their approved wording', () => {
  const dashboard = source('components/StudentDashboard.jsx')
  const account = source('components/AccountSecuritySettings.jsx')

  assert.match(dashboard, />Service progress</)
  assert.match(dashboard, />My QR code</)
  assert.match(dashboard, />View all</)
  assert.match(account, />Change Password</)
  assert.match(account, /Changing your password signs out other sessions\./)
})
