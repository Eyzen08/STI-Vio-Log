import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = (name) => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')

test('department attendance retains every column label in mobile records', async () => {
  const dtr = await source('components/DepartmentDtr.jsx')
  const headings = [...dtr.matchAll(/<th>([^<]+)<\/th>/g)].map((match) => match[1])
  const labels = [...dtr.matchAll(/<td data-label="([^"]+)"/g)].map((match) => match[1])
  assert.equal(headings.length, 8)
  assert.deepEqual(labels, headings)
  assert.match(dtr, /<table className="responsive-record-table department-dtr-table">/)
})

test('dynamic report cells derive mobile labels from the same keys as their headings', async () => {
  const app = await source('App.jsx')
  const department = await source('components/DepartmentReports.jsx')
  assert.match(app, /<table className="responsive-record-table report-record-table">/)
  assert.match(app, /data-label=\{reportColumnLabel\(Object.keys\(row\)\[cellIdx\]\)\}/)
  assert.match(department, /<table className="responsive-record-table report-record-table">/)
  assert.match(department, /data-label=\{formatDisplayLabel\(header\)\}/)
})

test('violation list and detail use readable status labels and keep record IDs', async () => {
  const dashboard = await source('components/StudentDashboard.jsx')
  const violations = await source('components/ViolationManagement.jsx')
  assert.match(violations, /formatDisplayLabel\(violation.status\)/)
  assert.match(await source('components/ViolationDrawerContext.jsx'), /formatDisplayLabel\(violation.status\)/)
  assert.match(dashboard, /formatDisplayLabel\(violation.status\)/)
  assert.match(violations, /data-label="ID">#\{violation.id\}/)
})
