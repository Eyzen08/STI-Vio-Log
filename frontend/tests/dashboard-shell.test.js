import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { validateSignatureFile } from '../src/lib/signatureImage.js'

test('quick actions are role scoped and navigate only within the role portal', () => {
  const source = fs.readFileSync(new URL('../src/components/DashboardQuickActions.jsx', import.meta.url), 'utf8')
  for (const label of ['Add Student', 'Issue Violation', 'Record Attendance', 'Review Registrations', 'Generate Report']) assert.match(source, new RegExp(label))
  assert.match(source, /STUDENT:[\s\S]*?\/student\/clearance/)
  assert.match(source, /DEPARTMENT_HEAD:[\s\S]*?\/department\/reports/)
})

test('profile menu resolves readable roles and preserved account routes', () => {
  const source = fs.readFileSync(new URL('../src/components/ProfileMenu.jsx', import.meta.url), 'utf8')
  assert.match(source, /DISCIPLINE_OFFICE: 'Discipline Office'/)
  assert.match(source, /\/student\/account-settings/)
  assert.match(source, /\/department\/account-settings/)
  assert.match(source, /\/admin\/account-settings/)
})

test('profile menu provides outside, Escape, navigation, and logout close behavior', () => {
  const source = fs.readFileSync(new URL('../src/components/ProfileMenu.jsx', import.meta.url), 'utf8')
  assert.match(source, /pointerdown/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /\[routePath\]/)
  assert.match(source, /choose\(onLogout\)/)
  assert.match(source, /aria-haspopup="menu"/)
})

test('signature image validation accepts only PNG or JPEG up to 1 MB', () => {
  assert.equal(validateSignatureFile({ type: 'image/png', size: 1024 }), '')
  assert.equal(validateSignatureFile({ type: 'image/jpeg', size: 1024 * 1024 }), '')
  assert.match(validateSignatureFile({ type: 'image/svg+xml', size: 10 }), /PNG or JPEG/)
  assert.match(validateSignatureFile({ type: 'image/png', size: 1024 * 1024 + 1 }), /1 MB/)
})

test('clearance renders the validated certificate workspace before legacy state', () => {
  const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const directWorkspace = source.indexOf("if (activeView === 'Clearance') return <AdminClearanceCertificates")
  const legacyForm = source.indexOf('Clearance Record')
  assert.ok(directWorkspace > -1)
  assert.ok(legacyForm === -1 || directWorkspace < legacyForm)
})
