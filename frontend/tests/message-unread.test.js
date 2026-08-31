import test from 'node:test'
import assert from 'node:assert/strict'
import { formatUnreadMessageCount, unreadMessageCount } from '../src/lib/messageUnread.js'

test('message badge totals only valid positive unread counts', () => {
  assert.equal(unreadMessageCount([{ unread_count: '2' }, { unread_count: 3 }, { unread_count: -1 }, {}]), 5)
  assert.equal(unreadMessageCount(), 0)
})

test('message badge hides zero and stays compact', () => {
  assert.equal(formatUnreadMessageCount(0), '')
  assert.equal(formatUnreadMessageCount(7), '7')
  assert.equal(formatUnreadMessageCount(120), '99+')
})
