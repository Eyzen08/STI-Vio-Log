import test from 'node:test'
import assert from 'node:assert/strict'
import * as targets from '../src/lib/studentNotifications.js'

test('notification destinations select exact records for the authenticated role', () => {
  assert.equal(typeof targets.notificationDestination, 'function')
  const destination = targets.notificationDestination
  assert.equal(destination({ resource_type: 'violations', resource_id: '12' }, 'STUDENT'), '/student/violations?violation_id=12')
  assert.equal(destination({ resource_type: 'violations', resource_id: 12 }, 'DISCIPLINE_OFFICE'), '/admin/violations?violation_id=12')
  assert.equal(destination({ resource_type: 'community_service_assignments', resource_id: 23 }, 'DEPARTMENT_HEAD'), '/department/community-service?assignment_id=23')
  assert.equal(destination({ resource_type: 'community_service_sessions', resource_id: 34, metadata: { assignment_id: 23 } }, 'DISCIPLINE_ADMIN'), '/admin/community-service?assignment_id=23&session_id=34')
  assert.equal(destination({ resource_type: 'message_conversations', resource_id: 45 }, 'STUDENT'), '/student/messages?conversation_id=45')
  assert.equal(destination({ resource_type: 'student_clearance', resource_id: 56 }, 'STUDENT'), '/student/clearance?clearance_id=56')
  assert.equal(destination({ resource_type: 'clearance_certificates', resource_id: 67 }, 'DISCIPLINE_ADMIN'), '/admin/clearance?panel=history&certificate_id=67')
  assert.equal(destination({ category: 'SECURITY' }, 'DEPARTMENT_HEAD'), '/department/account-settings?section=security')
  assert.equal(destination({ category: 'ATTENDANCE', metadata: { student_id: 78 } }, 'DISCIPLINE_ADMIN'), '/admin/students?student_id=78')
})

test('legacy and invalid targets stay on authorized internal pages with an unavailable notice', () => {
  assert.equal(typeof targets.notificationDestination, 'function')
  const destination = targets.notificationDestination
  assert.equal(destination({ category: 'COMMUNITY_SERVICE' }, 'STUDENT'), '/student/community-service?record_unavailable=1')
  assert.equal(destination({ category: 'VIOLATIONS', resource_type: 'violations', resource_id: '-1', link_path: 'https://evil.test' }, 'STUDENT'), '/student/violations?record_unavailable=1')
  assert.equal(destination({ link_path: '//evil.test' }, 'STUDENT'), '/student/notifications?record_unavailable=1')
  assert.equal(destination({ category: 'MESSAGES', resource_type: 'message_conversations', resource_id: 1 }, 'DEPARTMENT_HEAD'), '/department/notifications?record_unavailable=1')
  assert.equal(destination({ resource_type: 'violations', resource_id: '1e2' }, 'STUDENT'), '/student/violations?record_unavailable=1')
  assert.equal(destination({ link_path: '/admin/community-service?assignment_id=23' }, 'STUDENT'), '/student/community-service?assignment_id=23')
  assert.equal(destination({ category: 'VIOLATIONS', link_path: '/student/violations?student_id=23' }, 'STUDENT'), '/student/violations?record_unavailable=1')
  assert.equal(destination({ link_path: '/student/violations?assignment_id=23&session_id=34' }, 'STUDENT'), '/student/violations?record_unavailable=1')
  assert.equal(destination({ resource_type: 'violations', resource_id: 'bad', link_path: '/student/violations?violation_id=23' }, 'STUDENT'), '/student/violations?record_unavailable=1')
})

test('query targets survive navigation and can be removed without losing unrelated parameters', () => {
  assert.equal(typeof targets.notificationTarget, 'function')
  assert.deepEqual(targets.notificationTarget('?assignment_id=23&session_id=34'), { assignmentId: '23', sessionId: '34', invalid: false })
  assert.deepEqual(targets.notificationTarget('?violation_id=12'), { violationId: '12', invalid: false })
  assert.equal(targets.notificationTarget('?session_id=bad').invalid, true)
  assert.equal(targets.notificationTarget('?assignment_id=0').invalid, true)
  assert.equal(targets.notificationTarget('?violation_id=1&student_id=2').invalid, true)
  assert.equal(targets.notificationTarget('?violation_id=1&violation_id=2').invalid, true)
  assert.equal(targets.withoutNotificationTarget('/admin/clearance?panel=history&certificate_id=67'), '/admin/clearance?panel=history')
})
