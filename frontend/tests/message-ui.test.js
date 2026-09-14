import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { conversationMatchesTab, conversationParties, groupMessagesByDate, MESSAGE_MAX_LENGTH, messageParticipant } from '../src/lib/messageUi.js'

test('message UI helpers expose the required text limit and filters', () => {
  assert.equal(MESSAGE_MAX_LENGTH, 1000)
  assert.equal(conversationMatchesTab({ unread_count: 2, status: 'OPEN' }, 'UNREAD'), true)
  assert.equal(conversationMatchesTab({ unread_count: 0, status: 'OPEN' }, 'UNREAD'), false)
  assert.equal(conversationMatchesTab({ unread_count: 0, status: 'CLOSED' }, 'CLOSED'), true)
})

test('mobile messages keep a compact heading and keyboard-safe composer', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(app, /activeView === 'Messages' \? ' main-panel--messages' : ''/)
  assert.match(css, /\.messages-page-heading \{ display: flex; flex-direction: row;/)
  assert.match(css, /\.chat-composer \{ position: sticky; bottom: 0;/)
  assert.match(css, /\.chat-composer textarea \{[^}]*font-size: 16px/s)
})

test('message workspace keeps the composer visible and scrolls both content columns', async () => {
  const css = await readFile(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(css, /\.main-panel--messages\s*\{[^}]*height:\s*100dvh;[^}]*display:\s*flex;[^}]*overflow:\s*hidden;/s)
  assert.match(css, /\.main-panel--messages > \.page-content\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1 1 auto;[^}]*overflow:\s*hidden;/s)
  assert.match(css, /\.main-panel--messages \.messages-inbox\s*\{[^}]*height:\s*100%;[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s)
  assert.match(css, /\.main-panel--messages \.messages-workspace\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1 1 auto;/s)
  assert.match(css, /\.main-panel--messages :is\(\.conversation-list, \.chat-history\)\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s)
})

test('messages sent by the signed-in account align to the right', async () => {
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')
  assert.match(css, /\.message-bubble-row\.mine\s*\{[^}]*flex-direction:\s*row-reverse;[^}]*justify-content:\s*flex-start;/s)
})

test('Messages navigation stays yellow while previews use spaced light-blue cards', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
  assert.match(app, /messages-nav-item/)
  assert.match(css, /\.sidebar \.nav-item\.messages-nav-item\.active\s*\{[^}]*background:\s*var\(--portal-yellow\)/s)
  assert.match(css, /\.main-panel \.conversation-list\s*\{[^}]*gap:\s*8px;[^}]*padding:\s*8px;/s)
  assert.match(css, /\.conversation-list > button:not\(\.conversation-load-more\)\s*\{[^}]*border:\s*1px solid #c7dced;[^}]*border-radius:\s*10px;[^}]*background:\s*#edf6ff;/s)
  assert.match(css, /\.conversation-list > button\.active\s*\{[^}]*background:\s*#d9ecff;[^}]*inset 4px 0 #075cad/s)
  assert.match(css, /\.conversation-list > button\.unread:not\(\.active\)\s*\{[^}]*background:\s*#e2f1ff;/s)
  assert.match(css, /\.conversation-summary\s*\{\s*padding-right:\s*46px;/s)
  assert.match(css, /\.mobile-bottom-nav button\.messages-nav-item\.active\s*\{[^}]*background:\s*var\(--portal-yellow\) !important/s)
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

test('conversation parties identify the student and institutional recipient', () => {
  assert.deepEqual(
    conversationParties({ student_name: 'Pedro Makisig', school_participant: 'Discipline Office' }),
    { student: 'Pedro Makisig', school: 'Discipline Office', label: 'Pedro Makisig ↔ Discipline Office' }
  )
  assert.equal(
    conversationParties({ first_name: 'Ana', last_name: 'Montana', department_name: 'IT Department' }).label,
    'Ana Montana ↔ IT Department'
  )
  assert.equal(conversationParties({}).label, 'Student ↔ Discipline Office')
})

test('participant names are the primary conversation title and subject is secondary', async () => {
  const component = await readFile(new URL('../src/components/MessagesPage.jsx', import.meta.url), 'utf8')
  assert.match(component, /className="conversation-primary"><strong title=\{parties\.label\}>\{parties\.label\}<\/strong>/)
  assert.match(component, /className="conversation-subject-detail" title=\{`Subject: \$\{conversation\.subject\}`\}>Subject: \{conversation\.subject\}<\/span>/)
  assert.match(component, /<h3 title=\{selectedParties\.label\}>\{selectedParties\.label\}<\/h3>/)
  assert.match(component, /Conversation between \$\{parties\.student\} and \$\{parties\.school\}, subject: \$\{conversation\.subject\}/)
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
