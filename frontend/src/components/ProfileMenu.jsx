import { useEffect, useRef, useState } from 'react'
import PortalIcon from './PortalIcon.jsx'

const roleLabel = (role) => ({ SYSTEM_ADMIN: 'System Administrator', DISCIPLINE_ADMIN: 'Discipline Administrator', DISCIPLINE_OFFICE: 'Discipline Office', DEPARTMENT_HEAD: 'Department Head', STUDENT: 'Student' }[role] || 'Portal user')
const settingsPath = (role) => role === 'STUDENT' ? '/student/account-settings' : role === 'DEPARTMENT_HEAD' ? '/department/account-settings' : '/admin/account-settings'

function ProfileMenu({ user, routePath, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const firstItemRef = useRef(null)
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus()) }

  useEffect(() => { close(false) }, [routePath])
  useEffect(() => {
    if (!open) return undefined
    const outside = (event) => { if (!rootRef.current?.contains(event.target)) close(false) }
    const keyboard = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); return }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      const items = [...rootRef.current.querySelectorAll('[role="menuitem"]')]
      const current = items.indexOf(document.activeElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      event.preventDefault(); items[next]?.focus()
    }
    const focusOutside = (event) => { if (!rootRef.current?.contains(event.target)) close(false) }
    document.addEventListener('focusin', focusOutside)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', keyboard)
    firstItemRef.current?.focus()
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keyboard); document.removeEventListener('focusin', focusOutside) }
  }, [open])

  const username = user?.full_name || user?.username || 'Portal User'
  const initials = username.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U'
  const choose = (action) => { close(false); action() }

  return <div className="profile-menu" ref={rootRef}>
    <button ref={triggerRef} type="button" className="profile-menu-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span className="account-avatar">{initials}</span><span className="account-summary"><strong>{username}</strong><small>{roleLabel(user?.role)}</small></span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div className="profile-menu-popover" role="menu" aria-label="Profile options">
      <header><span className="account-avatar">{initials}</span><div><strong>{username}</strong><small>{roleLabel(user?.role)}</small></div></header>
      <button ref={firstItemRef} role="menuitem" type="button" onClick={() => choose(() => onNavigate(settingsPath(user?.role)))}><PortalIcon name="settings"/><span>Account Settings</span></button>
      <hr/>
      <button role="menuitem" type="button" className="profile-logout" onClick={() => choose(onLogout)}><PortalIcon name="logout"/><span>Logout</span></button>
    </div>}
  </div>
}

export default ProfileMenu
