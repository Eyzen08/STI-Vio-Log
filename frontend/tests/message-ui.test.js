import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { conversationMatchesTab, groupMessagesByDate, MESSAGE_MAX_LENGTH, messageParticipant } from '../src/lib/messageUi.js'

test('message UI helpers expose the required text limit and filters', () => {
  assert.equal(MESSAGE_MAX_LENGTH, 1000)
  assert.equal(conversationMatchesTab({ unread_count: 2, status: 'OPEN' }, 'UNREAD'), true)
  assert.equal(conversationMatchesTab({ unread_count: 0, status: 'OPEN' }, 'UNREAD'), false)
  assert.equal(conversationMatchesTab({ unread_count: 0, status: 'CLOSED' }, 'CLOSED'), true)
})

test('mobile messages keep a compact heading and keyboard-safe composer', async () => {
  const css = await readFile(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(css, /\.messages-page-heading \{ display: flex; flex-direction: row;/)
  assert.match(css, /\.chat-composer \{ position: sticky; bottom: 0;/)
  assert.match(css, /\.chat-composer textarea \{[^}]*font-size: 16px/s)
})

test('participants reveal only role-appropriate conversation metadata', () => {
  assert.deepEqual(
    messageParticipant({ school_participant: 'IT Department', assigned_department_id: 3 }, 'STUDENT'),
    { name: 'IT Department', detail: 'Department Head' }
  )
  assert.deepEqual(
    messageParticipant({ student_name: 'Jose Reyes', student_number: '02000123456' }, 'ADMIN'),
    { name: 'Jose Reyes', detail: '02000123456 · Student' }
  )
})

test('message history is grouped into accessible date sections', () => {
  const messages = [
    { id: 1, created_at: '2025-01-01T09:00:00Z' },
    { id: 2, created_at: '2025-01-01T10:00:00Z' },
    { id: 3, created_at: '2025-01-02T10:00:00Z' }
  ]
  const groups = groupMessagesByDate(messages)
  assert.equal(groups.length, 2)
  assert.deepEqual(groups.map(({ messages: items }) => items.map(({ id }) => id)), [[1, 2], [3]])
})
