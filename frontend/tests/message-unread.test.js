import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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

test('dashboard fallback polling uses the lightweight unread-count endpoint', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(source, /\/api\/messages\/unread-count/)
})
