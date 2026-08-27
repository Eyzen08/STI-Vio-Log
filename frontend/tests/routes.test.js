import test from 'node:test'
import assert from 'node:assert/strict'

import { getHomePath, getNavItems, resolveRoute } from '../src/lib/routes.js'

test('each supported role receives its own dashboard and navigation', () => {
  assert.equal(getHomePath('ADMIN'), '/admin/dashboard')
  assert.equal(getHomePath('DISCIPLINE_OFFICE'), '/admin/dashboard')
  assert.equal(getHomePath('DEPARTMENT_HEAD'), '/department/dashboard')
  assert.equal(getHomePath('STUDENT'), '/student/dashboard')
  assert.deepEqual(getNavItems('STUDENT').map(({ label }) => label), [
    'Dashboard', 'My Profile', 'My QR', 'My Violations', 'My Service', 'Notifications', 'My Clearance'
  ])
  assert.deepEqual(getNavItems('DEPARTMENT_HEAD').map(({ label }) => label), ['Dashboard', 'QR Scan', 'Students', 'DTR', 'Service', 'Non-Compliance', 'Reports'])
})

test('protected routes permit only their declared roles', () => {
  assert.equal(resolveRoute('/admin/students', 'ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/students', 'DISCIPLINE_OFFICE').status, 'allowed')
  assert.equal(resolveRoute('/admin/students', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/admin/registrations', 'ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/registrations', 'DISCIPLINE_OFFICE').status, 'allowed')
  assert.equal(resolveRoute('/admin/registrations', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/department/qr-scan', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/dtr', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/students', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/students', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/department/community-service', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/community-service', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/department/non-compliance', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/non-compliance', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/department/reports', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/reports', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/student/notifications', 'STUDENT').status, 'allowed')
  assert.equal(resolveRoute('/student/notifications', 'DEPARTMENT_HEAD').status, 'unauthorized')
  assert.equal(resolveRoute('/department/dtr', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/department/qr-scan', 'ADMIN').status, 'unauthorized')
})

test('public, unauthorized, and unknown locations resolve explicitly', () => {
  assert.equal(resolveRoute('/login', null).status, 'public')
  assert.equal(resolveRoute('/unauthorized', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/not-a-real-page', 'ADMIN').status, 'not_found')
})
