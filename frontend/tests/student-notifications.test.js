import test from 'node:test'
import assert from 'node:assert/strict'
import { notificationDate, notificationLabel, notificationSummary } from '../src/lib/studentNotifications.js'

test('student notifications summarize unread account updates', () => {
  assert.deepEqual(notificationSummary([{ is_read: false }, { is_read: true }, { is_read: false }]), { total: 3, unread: 2 })
  assert.deepEqual(notificationSummary(), { total: 0, unread: 0 })
})

test('student notification labels and dates use safe fallbacks', () => {
  assert.equal(notificationLabel('SERVICE_COMPLETED'), 'Service Completed')
  assert.equal(notificationLabel(), 'General')
  assert.equal(notificationDate('invalid'), 'Date unavailable')
})
