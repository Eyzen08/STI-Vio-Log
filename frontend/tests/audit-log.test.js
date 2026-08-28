import test from 'node:test'
import assert from 'node:assert/strict'
import { auditActorLabel, buildAuditQuery, formatAuditAction } from '../src/lib/auditLog.js'
import { APP_ROUTES, resolveRoute } from '../src/lib/routes.js'

test('audit query sends only non-empty filters with bounded page size', () => {
  assert.equal(buildAuditQuery({ action: ' ACCOUNT_CREATE ', table_name: '', from_date: '2026-08-01' }, 2), 'page=2&limit=25&action=ACCOUNT_CREATE&from_date=2026-08-01')
})
test('audit labels remain readable without exposing extra identity fields', () => {
  assert.equal(formatAuditAction('ACCOUNT_PASSWORD_RESET'), 'Account Password Reset'); assert.equal(auditActorLabel({ user_id: 7 }), 'User #7'); assert.equal(auditActorLabel({}), 'System')
})
test('audit log navigation and route are system-admin only', () => {
  const route = APP_ROUTES.find((candidate) => candidate.path === '/admin/audit-log'); assert.deepEqual(route.roles, ['ADMIN']); assert.equal(resolveRoute(route.path, 'ADMIN').status, 'allowed'); assert.equal(resolveRoute(route.path, 'DISCIPLINE_OFFICE').status, 'unauthorized')
})
