import test from 'node:test'
import assert from 'node:assert/strict'

import { getHomePath, getNavItems, resolveRoute } from '../src/lib/routes.js'

test('each supported role receives its own dashboard and navigation', () => {
  assert.equal(getHomePath('SYSTEM_ADMIN'), '/system/dashboard')
  assert.equal(getHomePath('DISCIPLINE_ADMIN'), '/admin/dashboard')
  assert.equal(getHomePath('DISCIPLINE_OFFICE'), '/admin/dashboard')
  assert.equal(getHomePath('DEPARTMENT_HEAD'), '/department/dashboard')
  assert.equal(getHomePath('STUDENT'), '/student/dashboard')
  assert.deepEqual(getNavItems('STUDENT').map(({ label }) => label), [
    'Dashboard', 'My Profile', 'My QR', 'My Violations', 'My Service', 'Notifications', 'Messages', 'My Clearance'
  ])
  assert.deepEqual(getNavItems('DEPARTMENT_HEAD').map(({ label }) => label), ['Dashboard', 'Assigned Students', 'QR Scan', 'Service Results', 'Attendance', 'Follow-up', 'Reports', 'Messages', 'Notifications'])
  const adminReviewItems = getNavItems('DISCIPLINE_ADMIN').filter(({ view }) => view === 'Registrations')
  assert.deepEqual(adminReviewItems.map(({ label }) => label), ['Registration & Duplicate Review'])
})

test('protected routes permit only their declared roles', () => {
  assert.equal(resolveRoute('/admin/students', 'DISCIPLINE_ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/account-settings', 'DISCIPLINE_ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/account-settings', 'DISCIPLINE_OFFICE').status, 'allowed')
  assert.equal(resolveRoute('/admin/students', 'DISCIPLINE_OFFICE').status, 'allowed')
  assert.equal(resolveRoute('/admin/students', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/admin/registrations', 'DISCIPLINE_ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/registrations', 'DISCIPLINE_OFFICE').status, 'allowed')
  assert.equal(resolveRoute('/admin/registrations', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/admin/departments-officers', 'DISCIPLINE_ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/department-accounts', 'DISCIPLINE_ADMIN').redirectTo, '/admin/departments-officers')
  assert.equal(resolveRoute('/admin/department-accounts', 'DISCIPLINE_OFFICE').status, 'unauthorized')
  assert.equal(resolveRoute('/admin/accounts', 'DISCIPLINE_ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/accounts', 'DISCIPLINE_OFFICE').status, 'unauthorized')
  assert.equal(resolveRoute('/admin/departments', 'DISCIPLINE_ADMIN').status, 'allowed')
  assert.equal(resolveRoute('/admin/departments', 'DISCIPLINE_OFFICE').status, 'unauthorized')
  assert.equal(resolveRoute('/department/qr-scan', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/dtr', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/students', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/community-service', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/community-service', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/department/non-compliance', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/reports', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/student/notifications', 'STUDENT').status, 'allowed')
  assert.equal(resolveRoute('/student/notifications', 'DEPARTMENT_HEAD').status, 'unauthorized')
  assert.equal(resolveRoute('/student/messages', 'STUDENT').status, 'allowed')
  assert.equal(resolveRoute('/admin/messages', 'DISCIPLINE_OFFICE').status, 'allowed')
  assert.equal(resolveRoute('/department/messages', 'DEPARTMENT_HEAD').status, 'allowed')
  assert.equal(resolveRoute('/department/dtr', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/department/qr-scan', 'DISCIPLINE_ADMIN').status, 'unauthorized')
})

test('public, unauthorized, and unknown locations resolve explicitly', () => {
  assert.equal(resolveRoute('/login', null).status, 'public')
  assert.equal(resolveRoute('/register', null).status, 'public')
  assert.equal(resolveRoute('/verify-email', null).status, 'public')
  assert.equal(resolveRoute('/forgot-password', null).status, 'public')
  assert.equal(resolveRoute('/reset-password/verify', null).status, 'public')
  assert.equal(resolveRoute('/reset-password/new', null).status, 'public')
  assert.equal(resolveRoute('/privacy', null).status, 'public')
  assert.equal(resolveRoute('/terms', null).status, 'public')
  assert.equal(resolveRoute('/department/register', null).status, 'not_found')
  assert.equal(resolveRoute('/unauthorized', 'STUDENT').status, 'unauthorized')
  assert.equal(resolveRoute('/not-a-real-page', 'DISCIPLINE_ADMIN').status, 'not_found')
})
