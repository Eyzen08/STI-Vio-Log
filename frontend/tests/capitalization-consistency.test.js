import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

test('canonical page and navigation names keep approved capitalization', () => {
  const routes = source('lib/routes.js')
  const app = source('App.jsx')
  const departmentDtr = source('components/DepartmentDtr.jsx')

  for (const label of ['Community Service', 'Account Settings', 'Assigned Students', 'Audit Log', 'QR Scan']) {
    assert.match(routes, new RegExp(`label: '${label}'`))
  }
  assert.match(app, /<h2>Student Management<\/h2>/)
  assert.match(app, /<h2>Violation Management<\/h2>/)
  assert.match(departmentDtr, /<h2>Daily Time Record<\/h2>/)
  assert.doesNotMatch(departmentDtr, />Daily time record</)
})

test('headings and actions use title case while descriptions stay sentence case', () => {
  const dashboard = source('components/StudentDashboard.jsx')
  const account = source('components/AccountSecuritySettings.jsx')

  assert.match(dashboard, />Service Session in Progress</)
  assert.match(dashboard, />My QR Code</)
  assert.match(dashboard, />View All</)
  assert.match(account, />Change Password</)
  assert.match(account, /Changing your password signs out other sessions\./)
})
