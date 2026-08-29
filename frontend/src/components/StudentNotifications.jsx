import { notificationDate, notificationLabel, notificationSummary } from '../lib/studentNotifications.js'

function StudentNotifications({ notifications, loading, error, onMarkRead }) {
  const items = Array.isArray(notifications) ? notifications : []
  const summary = notificationSummary(items)
  if (loading) return <section className="dashboard-loading" aria-live="polite"><div className="skeleton skeleton-heading" /><div className="skeleton skeleton-card" /></section>
  return <div className="student-notifications-page">
    <section className="notifications-hero"><div><p className="eyebrow">Student updates</p><h2>Notifications</h2><p>Disciplinary, service, attendance, and clearance updates for your account.</p></div><div><strong>{summary.unread}</strong><span>unread of {summary.total}</span></div></section>
    {error && <p className="error-message dashboard-error" role="alert">{error}</p>}
    <section className="table-card"><div className="table-header"><div><p className="eyebrow">Newest first</p><h3>Your updates</h3></div><span>{items.length} notifications</span></div>
      {items.length === 0 ? <div className="department-empty"><h4>No notifications yet</h4><p>New account and service updates will appear here.</p></div> : <div className="notification-list">{items.map((item) => <article key={item.id} className={item.is_read ? '' : 'unread'}><span className="notification-indicator" aria-label={item.is_read ? 'Read' : 'Unread'} /><div><div className="notification-heading"><h4>{item.title}</h4><span>{notificationLabel(item.notification_type)}</span></div><p>{item.message}</p><time dateTime={item.created_at}>{notificationDate(item.created_at)}</time>{!item.is_read && onMarkRead && <button type="button" className="secondary-button" onClick={() => onMarkRead(item.id)}>Mark as read</button>}</div></article>)}</div>}
    </section><p className="scope-note">Notifications belong exclusively to your authenticated account. Marking one as read does not alter the underlying school record.</p>
  </div>
}
export default StudentNotifications
