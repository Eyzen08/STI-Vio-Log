import { readPortalStyles } from './helpers/portalStyles.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { conversationMatchesTab, conversationTimeLabel, conversationParties, groupMessagesByDate, MESSAGE_MAX_LENGTH, messageParticipant } from '../src/lib/messageUi.js'

test('message UI helpers expose the required text limit and filters', () => {
  assert.equal(MESSAGE_MAX_LENGTH, 1000)
  assert.equal(conversationMatchesTab({ unread_count: 2, status: 'OPEN' }, 'UNREAD'), true)
  assert.equal(conversationMatchesTab({ unread_count: 0, status: 'OPEN' }, 'UNREAD'), false)
  assert.equal(conversationMatchesTab({ unread_count: 0, status: 'CLOSED' }, 'CLOSED'), true)
})

test('mobile messages keep a compact heading and keyboard-safe composer', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const baseCss = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')
  const css = readPortalStyles()
  assert.match(app, /activeView === 'Messages' \? ' main-panel--messages' : ''/)
  assert.match(css, /\.messages-page-heading \{ display: flex; flex-direction: row;/)
  assert.match(css, /\.chat-composer \{ position: sticky; bottom: 0;/)
  assert.match(css, /\.chat-composer textarea \{[^}]*font-size: var\(--text-control\)/s)
  assert.match(baseCss, /\.chat-composer > button \{[^}]*align-self:\s*center;/s)
})

test('open mobile threads use the full message workspace without the page heading', async () => {
  const component = await readFile(new URL('../src/components/MessagesPage.jsx', import.meta.url), 'utf8')
  const css = readPortalStyles()
  assert.match(component, /messages-page messages-inbox\$\{selected\?' has-open-thread':''\}/)
  assert.match(css, /@media \(max-width:900px\)[\s\S]*?\.messages-inbox\.has-open-thread\s*\{[^}]*gap:\s*0;/)
  assert.match(css, /@media \(max-width:900px\)[\s\S]*?\.messages-inbox\.has-open-thread > \.messages-page-heading\s*\{[^}]*display:\s*none;/)
  assert.match(css, /\.messages-inbox:not\(\.has-open-thread\) \.chat-pane\s*\{\s*display:none;/)
})

test('message composer uses the shared professional send icon', async () => {
  const component = await readFile(new URL('../src/components/MessagesPage.jsx', import.meta.url), 'utf8')
  const icons = await readFile(new URL('../src/components/PortalIcon.jsx', import.meta.url), 'utf8')
  assert.match(component, /<PortalIcon name="send" \/>/)
  assert.doesNotMatch(component, /↗/)
  assert.match(icons, /send:\s*<><path/)
})

test('message workspace keeps the composer visible and scrolls both content columns', async () => {
  const css = readPortalStyles()
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

test('Messages previews use compact blue selected cards', async () => {
 const css=await readFile(new URL('../src/styles/messages-workflow.css',import.meta.url),'utf8')
 assert.match(css,/grid-template-columns:380px minmax/)
 assert.match(css,/min-height:78px/)
 assert.match(css,/background:#e0efff!important/)
 assert.match(css,/conversation-preview/)
})

test('participants reveal only role-appropriate conversation metadata', () => {
  assert.deepEqual(
    messageParticipant({ school_participant: 'IT Department', assigned_department_id: 3 }, 'STUDENT'),
    { name: 'IT Department', detail: 'Department Head' }
  )
  assert.deepEqual(
    messageParticipant({ student_name: 'Jose Reyes', student_number: '02000123456' }, 'ADMIN'),
    { avatar:undefined, name: 'Jose Reyes', detail: '02000123456 · Student' }
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

test('participant names and previews avoid repeated institutional labels', async () => {
 const component=await readFile(new URL('../src/components/MessagesPage.jsx',import.meta.url),'utf8')
 assert.match(component,/title=\{itemParticipant.name\}/)
 assert.match(component,/conversation.message_preview/)
 assert.match(component,/title=\{participant.name\}/)
 assert.doesNotMatch(component,/conversationParties|selectedParties/)
})

test('recipient autocomplete searches authorized results and supports keyboard selection', async () => {
 const component=await readFile(new URL('../src/components/MessagesPage.jsx',import.meta.url),'utf8')
 assert.match(component,/query.set\('search',normalizedSearch\)/)
 assert.match(component,/recipientSearch.trim\(\).length<2/)
 assert.match(component,/window.setTimeout\(\(\)=>loadRecipients\(recipientSearch\),300\)/)
 assert.match(component,/ArrowDown','ArrowUp/)
 assert.match(component,/aria-activedescendant/)
 assert.match(component,/requestId!==recipientRequestRef.current/)
 assert.match(component,/aria-label="Change recipient"/)
 assert.doesNotMatch(component,/searchRecipients/)
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

test('preview times use the Manila calendar and today time',()=>{
 const now=new Date('2026-10-07T08:00:00Z')
 assert.match(conversationTimeLabel('2026-10-07T07:32:00Z',now),/3:32 PM/)
 assert.equal(conversationTimeLabel('2026-10-06T07:32:00Z',now),'Yesterday')
})
