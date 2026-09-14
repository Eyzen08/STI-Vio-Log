import { useMemo, useState } from 'react'
import { notificationDate, notificationLabel, notificationSummary } from '../lib/studentNotifications.js'
import AsyncActionButton from './AsyncActionButton.jsx'

const categories = ['ALL', 'SECURITY', 'ATTENDANCE', 'COMMUNITY_SERVICE', 'VIOLATIONS', 'CLEARANCE', 'MESSAGES', 'SYSTEM']

function StudentNotifications({ notifications, loading, error, onMarkRead, onAcknowledge, onMarkAll, onNavigate, actionBusy = {}, audience = 'STUDENT' }) {
  const items = useMemo(() => Array.isArray(notifications) ? notifications : [], [notifications])
  const [state, setState] = useState('ALL')
  const [category, setCategory] = useState('ALL')
  const summary = notificationSummary(items)
  const visible = useMemo(() => items.filter((item) => {
    if (state === 'UNREAD' && item.is_read) return false
    if (state === 'READ' && !item.is_read) return false
    return category === 'ALL' || item.category === category
  }), [items, state, category])

  if (loading) return <section className="dashboard-loading" aria-live="polite"><div className="skeleton skeleton-heading" /><div className="skeleton skeleton-card" /></section>

  return <div className="student-notifications-page">
    <section className="notifications-hero"><div><p className="eyebrow">{audience === 'STUDENT' ? 'Student updates' : 'Staff operations'}</p><h2>Notifications</h2><p>{audience === 'STUDENT' ? 'Disciplinary, service, attendance, and clearance updates for your account.' : 'Attendance events and operational alerts requiring staff awareness.'}</p></div><div><strong>{summary.unread}</strong><span>unread of {summary.total}</span></div></section>
    {error && <p className="error-message dashboard-error" role="alert">{error}</p>}
    <section className="table-card">
      <div className="table-header notification-toolbar"><div><p className="eyebrow">Newest first</p><h3>Your updates</h3></div><div className="notification-filters"><label><span>Status</span><select value={state} onChange={(event) => setState(event.target.value)}><option value="ALL">All</option><option value="UNREAD">Unread</option><option value="READ">Read</option></select></label><label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option value={value} key={value}>{notificationLabel(value)}</option>)}</select></label>{summary.unread > 0 && <AsyncActionButton type="button" className="secondary-button" busy={actionBusy.notificationsReadAll} busyLabel="Marking read…" onClick={() => onMarkAll?.(category)}>Mark all read</AsyncActionButton>}</div></div>
      {visible.length === 0
        ? <div className="department-empty"><h4>{error ? 'Notifications unavailable' : items.length ? 'No matching notifications' : 'You’re all caught up'}</h4><p>{error ? 'Please try again shortly.' : items.length ? 'Change the status or category filter to see more updates.' : 'New account and service updates will appear here.'}</p>{items.length > 0 && <button type="button" className="secondary-button" onClick={() => { setState('ALL'); setCategory('ALL') }}>Clear filters</button>}</div>
        : <div className="notification-list">{visible.map((item) => <article key={item.id} className={item.is_read ? '' : 'unread'}><span className="notification-indicator" aria-label={item.is_read ? 'Read' : 'Unread'} /><div><div className="notification-heading"><h4>{item.title}</h4><span>{notificationLabel(item.category || item.notification_type)}{item.severity && item.severity !== 'INFO' ? ` · ${notificationLabel(item.severity)}` : ''}</span></div><p>{item.message}</p><time dateTime={item.created_at}>{notificationDate(item.created_at)}</time><div className="notification-actions">{item.category === 'SECURITY' && !item.acknowledged_at && onAcknowledge ? <AsyncActionButton type="button" className="secondary-button" busy={actionBusy[`notification-${item.id}`]} busyLabel="Acknowledging…" onClick={() => onAcknowledge(item.id)}>Acknowledge</AsyncActionButton> : !item.is_read && onMarkRead && <AsyncActionButton type="button" className="secondary-button" busy={actionBusy[`notification-${item.id}`]} busyLabel="Marking read…" onClick={() => onMarkRead(item.id)}>Mark as read</AsyncActionButton>}{item.category === 'SECURITY' && item.acknowledged_at && <span className="scope-note">Acknowledged</span>}{item.link_path && onNavigate && <button type="button" className="text-button" onClick={() => onNavigate(item.link_path)}>Open record</button>}</div></div></article>)}</div>}
    </section>
    <p className="scope-note">Notifications belong exclusively to your authenticated account. Marking one as read does not alter the underlying school record.</p>
  </div>
}

export default StudentNotifications
