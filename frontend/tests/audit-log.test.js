import test from 'node:test'
import assert from 'node:assert/strict'
import { auditActorLabel, buildAuditQuery, formatAuditAction } from '../src/lib/auditLog.js'
import { APP_ROUTES, resolveRoute } from '../src/lib/routes.js'
import * as audit from '../src/lib/auditLog.js'

test('audit summaries explain recorded outcomes without losing zero credit', () => {
  assert.match(audit.auditSummary({ action: 'TIME_IN', record_context: { department_name: 'Library', supervisor_name: 'Ana Cruz' }, details: {} }), /Started community service at Library, supervised by Ana Cruz/)
  assert.match(audit.auditSummary({ action: 'TIME_OUT_CREDITED', details: { attendance_outcome: 'LEFT_EARLY', credited_minutes: 0 } }), /Timed out early; 0 minutes credited/)
  assert.match(audit.auditSummary({ action: 'TIME_OUT_CREDITED', details: { worked_minutes: 438, credited_minutes: 438, limit_reached: true } }), /7 hr 18 min credited/)
  assert.match(audit.auditSummary({ action: 'COMPLETE', details: { from_status: 'OPEN', to_status: 'COMPLETED' } }), /Open to Completed/)
  assert.match(audit.auditSummary({ action: 'OFFENSE_ESCALATED', details: { from: 'NEUTRAL', to: 'GRAVE' } }), /Neutral to Grave/)
  assert.match(audit.auditSummary({ action: 'UPDATE', details: { changes: { required_service_hours: { before: 2, after: 0 } } } }), /required service hours/i)
})

test('audit fallbacks keep existing text and identify unknown or missing records', () => {
  assert.equal(audit.auditSummary({ action: 'AVATAR_SELECT', description: 'Selected preset avatar' }), 'Selected preset avatar')
  assert.equal(audit.auditRecordLabel({ table_name: 'community_service_sessions', record_id: 24 }), 'Community service session #24')
  assert.equal(audit.auditRecordLabel({ table_name: 'future_records', record_id: 8 }), 'Future Records #8')
  assert.match(audit.auditSummary({ action: 'FUTURE_EVENT', description: '{broken json' }), /Future Event/)
  assert.equal(auditActorLabel({ actor_name: 'Ana Cruz', actor_username: 'ana' }), 'Ana Cruz')
  assert.ok(audit.auditDetailRows({ details: { credited_minutes: 0, supervisor_changed: false, changes: { required_service_hours: { before: 2, after: 0 } } } }).some((row) => row.value === '2 hr → 0 min'))
})

test('audit query sends only non-empty filters with bounded page size', () => {
  assert.equal(buildAuditQuery({ action: ' ACCOUNT_CREATE ', table_name: '', from_date: '2026-08-01' }, 2), 'page=2&limit=25&action=ACCOUNT_CREATE&from_date=2026-08-01')
})
test('audit labels remain readable without exposing extra identity fields', () => {
  assert.equal(formatAuditAction('ACCOUNT_PASSWORD_RESET'), 'Account Password Reset'); assert.equal(auditActorLabel({ user_id: 7 }), 'User #7'); assert.equal(auditActorLabel({}), 'System')
})
test('audit log navigation and route are discipline-admin only', () => {
  const route = APP_ROUTES.find((candidate) => candidate.path === '/admin/audit-log'); assert.deepEqual(route.roles, ['DISCIPLINE_ADMIN']); assert.equal(resolveRoute(route.path, 'DISCIPLINE_ADMIN').status, 'allowed'); assert.equal(resolveRoute(route.path, 'DISCIPLINE_OFFICE').status, 'unauthorized')
})
