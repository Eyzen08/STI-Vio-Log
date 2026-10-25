import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PortalIcon from './PortalIcon.jsx'

const positionFor = (rect, size) => ({
  left: Math.max(8, Math.min(rect.right - size.width, window.innerWidth - size.width - 8)),
  top: Math.max(8, Math.min(rect.bottom + size.height + 6 > window.innerHeight - 8 ? rect.top - size.height - 6 : rect.bottom + 6, window.innerHeight - size.height - 8))
})

export default function ConversationActions({ conversation, busy, onAction, onViewStudent }) {
  const [position, setPosition] = useState(null)
  const trigger = useRef(null)
  const menu = useRef(null)
  const open = Boolean(position)
  const unread = Number(conversation.unread_count) > 0
  const studentId = Number(conversation.student_id)
  const canViewStudent = Boolean(onViewStudent) && Number.isSafeInteger(studentId) && studentId > 0
  useLayoutEffect(() => {
    if (open) setPosition(positionFor(trigger.current.getBoundingClientRect(), menu.current.getBoundingClientRect()))
  }, [open, canViewStudent])
  useEffect(() => {
    if (!open) return undefined
    menu.current?.querySelector('button')?.focus({ preventScroll: true })
    const dismiss = (event) => {
      if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setPosition(null)
    }
    const escape = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); setPosition(null); trigger.current?.focus({ preventScroll: true }) }
    }
    const scroll = (event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) setPosition(null)
      else setPosition(current => current ? positionFor(rect, menu.current.getBoundingClientRect()) : null)
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('focusin', dismiss)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', scroll)
    window.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('focusin', dismiss)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', scroll)
      window.removeEventListener('scroll', scroll, true)
    }
  }, [open])
  const toggle = () => {
    setPosition(current => current ? null : { left: 8, top: 8 })
  }
  const choose = (action, values) => { setPosition(null); trigger.current?.focus({ preventScroll: true }); onAction(conversation, action, values) }
  const keys = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = [...menu.current.querySelectorAll('button')]
    const current = items.indexOf(document.activeElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }
  return <>
    <button ref={trigger} type="button" className="conversation-actions-trigger" aria-label={`Actions for ${conversation.subject}`} aria-haspopup="menu" aria-expanded={Boolean(position)} disabled={busy} onClick={toggle}><PortalIcon name="more"/></button>
    {position && createPortal(<div ref={menu} className="conversation-actions-menu" style={position} role="menu" aria-label={`Conversation actions: ${conversation.subject}`} onKeyDown={keys}>
      <button type="button" role="menuitem" onClick={() => choose('read', { is_read: unread })}>{unread ? 'Mark as read' : 'Mark as unread'}</button>
      <button type="button" role="menuitem" onClick={() => choose('preferences', { is_pinned: !conversation.is_pinned })}>{conversation.is_pinned ? 'Unpin' : 'Pin'}</button>
      <button type="button" role="menuitem" onClick={() => choose('preferences', { is_archived: !conversation.is_archived })}>{conversation.is_archived ? 'Unarchive' : 'Archive'}</button>
      {canViewStudent && <button type="button" role="menuitem" onClick={() => { setPosition(null); trigger.current?.focus({ preventScroll: true }); onViewStudent(studentId) }}>View Student</button>}
      <button type="button" role="menuitem" className="conversation-delete-action" onClick={() => choose('delete')}>Delete</button>
    </div>, document.body)}
  </>
}
