import test from 'node:test'
import assert from 'node:assert/strict'

import { getHomePath, getNavItems, resolveRoute } from '../src/lib/routes.js'

test('each supported role receives its own dashboard and navigation', () => {
  assert.equal(getHomePath('ADMIN'), '/admin/dashboard')
  assert.equal(getHomePath('DISCIPLINE_OFFICE'), '/admin/dashboard')
  assert.equal(getHomePath('DEPARTMENT_HEAD'), '/department/qr-scan')
  assert.equal(getHomePath('STUDENT'), '/student/dashboard')
  assert.deepEqual(getNavItems('STUDENT').map(({ label }) => label), [
    'Dashboard', 'My Profile', 'My QR', 'My Violations', 'My Service', 'Notifications', 'Messages', 'My Clearance'
  ])
  assert.deepEqual(getNavItems('DEPARTMENT_HEAD').map(({ label }) => label), ['QR Scan', 'Service Results', 'Messages'])
})

test('protected routes permit only their declared roles', () => {
  assert.equal(resolveRoute('/admin/students', 'ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/students', 'DISCIPLINE_OFFICE').status, 'allowed')
  assert.equal(resolveRoute('/admin/students', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/admin/registrations', 'ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/registrations', 'DISCIPLINE_OFFICE').status, 'allowed')
  assert.equal(resolveRoute('/admin/registrations', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/admin/departments-officers', 'ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/department-accounts', 'ADMIN').redirectTo, '/admin/departments-officers')
  assert.equal(resolveRoute('/admin/department-accounts', 'DISCIPLINE_OFFICE').status, 'unauthorized')
  assert.equal(resolveRoute('/admin/accounts', 'ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/accounts', 'DISCIPLINE_OFFICE').status, 'unauthorized')
  assert.equal(resolveRoute('/admin/departments', 'ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/departments', 'DISCIPLINE_OFFICE').status, 'unauthorized')
  assert.equal(resolveRoute('/department/qr-scan', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/dtr', 'DEPARTMENT_HEAD').status, 'not_found')
  assert.equal(resolveRoute('/department/students', 'DEPARTMENT_HEAD').status, 'not_found')
  assert.equal(resolveRoute('/department/community-service', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/community-service', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/department/non-compliance', 'DEPARTMENT_HEAD').status, 'not_found')
  assert.equal(resolveRoute('/department/reports', 'DEPARTMENT_HEAD').status, 'not_found')
  assert.equal(resolveRoute('/student/notifications', 'STUDENT').status, 'allowed')
  assert.equal(resolveRoute('/student/notifications', 'DEPARTMENT_HEAD').status, 'unauthorized')
  assert.equal(resolveRoute('/student/messages', 'STUDENT').status, 'allowed')
  assert.equal(resolveRoute('/admin/messages', 'DISCIPLINE_OFFICE').status, 'allowed')
  assert.equal(resolveRoute('/department/messages', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/dtr', 'STUDENT').status, 'not_found')
  assert.equal(resolveRoute('/department/qr-scan', 'ADMIN').status, 'unauthorized')
})

test('public, unauthorized, and unknown locations resolve explicitly', () => {
  assert.equal(resolveRoute('/login', null).status, 'public')
  assert.equal(resolveRoute('/register', null).status, 'public')
  assert.equal(resolveRoute('/verify-email', null).status, 'public')
  assert.equal(resolveRoute('/forgot-password', null).status, 'public')
  assert.equal(resolveRoute('/reset-password/verify', null).status, 'public')
  assert.equal(resolveRoute('/reset-password/new', null).status, 'public')
  assert.equal(resolveRoute('/department/register', null).status, 'not_found')
  assert.equal(resolveRoute('/unauthorized', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/not-a-real-page', 'ADMIN').status, 'not_found')
})
