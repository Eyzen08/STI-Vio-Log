import PortalIcon from './PortalIcon.jsx'

const ACTIONS = {
  ADMIN: [
    ['students', 'Add Student', '/admin/students'], ['violations', 'Issue Violation', '/admin/violations'],
    ['qr', 'Record Attendance', '/admin/qr-scan'], ['registrations', 'Review Registrations', '/admin/registrations'],
    ['reports', 'Generate Report', '/admin/reports']
  ],
  DISCIPLINE_OFFICE: [
    ['students', 'Add Student', '/admin/students'], ['violations', 'Issue Violation', '/admin/violations'],
    ['qr', 'Record Attendance', '/admin/qr-scan'], ['registrations', 'Review Registrations', '/admin/registrations'],
    ['reports', 'Generate Report', '/admin/reports']
  ],
  DEPARTMENT_HEAD: [
    ['qr', 'Scan QR Code', '/department/qr-scan'], ['students', 'Assigned Students', '/department/students'],
    ['clock', 'Service Monitoring', '/department/community-service'], ['reports', 'Generate Report', '/department/reports']
  ],
  STUDENT: [
    ['qr', 'My QR Code', '/student/qr'], ['violations', 'My Violations', '/student/violations'],
    ['clock', 'My Service', '/student/community-service'], ['clearance', 'My Clearance', '/student/clearance']
  ]
}

function DashboardQuickActions({ role, onNavigate, pendingRegistrations = 0 }) {
  const actions = ACTIONS[role] || []
  if (!actions.length) return null
  return <section className="dashboard-card dashboard-quick-actions" aria-labelledby={`${role}-quick-actions`}>
    <header><h3 id={`${role}-quick-actions`}>Quick actions</h3></header>
    <div>{actions.map(([icon, label, path]) => <button type="button" key={path} onClick={() => onNavigate?.(path)}><PortalIcon name={icon}/><span>{label}</span>{path === '/admin/registrations' && pendingRegistrations > 0 && <b aria-label={`${pendingRegistrations} pending registrations`}>{pendingRegistrations}</b>}</button>)}</div>
  </section>
}

export { ACTIONS }
export default DashboardQuickActions
