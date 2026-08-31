import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { unreadMessageCount } from '../lib/messageUnread.js'

function MessagesPage({ token, role, students = [], onUnreadChange }) {
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [form, setForm] = useState({ student_id: '', subject: '', message: '' })
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const isStudent = role === 'STUDENT'

  const load = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/messages/conversations`, { headers })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || 'Unable to load conversations.')
    const items = data.conversations || []
    setConversations(items)
    onUnreadChange?.(unreadMessageCount(items))
  }, [token, onUnreadChange]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load().catch((e) => setError(e.message)) }, [load])

  const open = async (conversation) => {
    setError('')
    const response = await fetch(`${API_URL}/api/messages/conversations/${conversation.id}`, { headers })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data.message || 'Unable to open conversation.')
    setSelected(data.conversation); setMessages(data.messages || [])
    await fetch(`${API_URL}/api/messages/conversations/${conversation.id}/read`, { method: 'PATCH', headers, body: '{}' })
    load().catch(() => {})
  }

  const create = async (event) => {
    event.preventDefault(); setError('')
    const body = isStudent ? { subject: form.subject, message: form.message } : form
    const response = await fetch(`${API_URL}/api/messages/conversations`, { method: 'POST', headers, body: JSON.stringify(body) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data.message || 'Unable to create conversation.')
    setForm({ student_id: '', subject: '', message: '' }); await load(); await open(data.conversation)
  }

  const send = async (event) => {
    event.preventDefault(); setError('')
    const response = await fetch(`${API_URL}/api/messages/conversations/${selected.id}/messages`, { method: 'POST', headers, body: JSON.stringify({ message: reply }) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data.message || 'Unable to send message.')
    setReply(''); await open(selected)
  }

  return <div className="messages-page"><section className="department-welcome"><div><p className="eyebrow">Secure communication</p><h2>Messages</h2><p>Text-only conversations between students and authorized school personnel.</p></div></section>
    {error && <p className="error-message" role="alert">{error}</p>}
    {(isStudent || role === 'ADMIN' || role === 'DISCIPLINE_OFFICE') && <form className="table-card message-compose" onSubmit={create}><h3>New conversation</h3>{!isStudent && <label>Student<select required value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}><option value="">Select student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.student_number} - {s.first_name} {s.last_name}</option>)}</select></label>}<label>Subject<input required maxLength="200" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label><label>Message<textarea required maxLength="2000" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label><button>Start conversation</button></form>}
    <div className="message-layout"><section className="table-card message-conversations"><h3>Conversations</h3>{conversations.length === 0 ? <p>No conversations yet.</p> : conversations.map((c) => <button type="button" key={c.id} className={selected?.id === c.id ? 'active' : ''} onClick={() => open(c)}><strong>{c.subject}</strong><span>{c.student_number} · {c.first_name} {c.last_name}</span>{Number(c.unread_count) > 0 && <b>{c.unread_count}</b>}</button>)}</section>
      <section className="table-card message-thread">{!selected ? <p>Select a conversation.</p> : <><h3>{selected.subject}</h3><div>{messages.map((m) => <article key={m.id} className={m.sent_by_me ? 'mine' : ''}><strong>{m.sent_by_me ? 'You' : m.sender_name} · {m.sender_role.replaceAll('_', ' ')}</strong><p>{m.message_text}</p><time>{new Date(m.created_at).toLocaleString()}</time></article>)}</div><form onSubmit={send}><textarea required maxLength="2000" value={reply} onChange={(e) => setReply(e.target.value)} /><button>Send reply</button></form></>}</section></div>
    <p className="scope-note">Messages are append-only. Do not send passwords, authentication codes, or Google credentials.</p></div>
}
export default MessagesPage
