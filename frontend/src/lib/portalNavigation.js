import { APP_ROUTES, getNavItems } from './routes.js'

const SIDEBAR_GROUPS = [
  { id: 'discipline', label: 'Discipline', icon: 'violations', views: ['Violations', 'Active Attendance', 'Community Service', 'QR Scan', 'Clearance'] },
  { id: 'reports', label: 'Reports', icon: 'reports', views: ['Reports', 'Audit Log'] },
  { id: 'management', label: 'System & Management', icon: 'settings', views: ['Departments & Officer Accounts', 'Duplicate Review', 'System Dashboard', 'Account Settings'] }
]

// Sidebar presentation is separate from route protection and mobile shortcuts.
export const sidebarNavigationFor = (role = '') => {
  const items = getNavItems(role)
  const settings = APP_ROUTES.find((route) => route.view === 'Account Settings' && route.roles.includes(role))
  if (settings) items.push({ ...settings, label: 'Settings' })

  const page = (view) => {
    const item = items.find((candidate) => candidate.view === view)
    return item ? { ...item, type: 'page' } : null
  }
  const groups = SIDEBAR_GROUPS.map((group) => {
    const views = group.id !== 'discipline' ? group.views
      : role === 'DEPARTMENT_HEAD' ? ['DTR', 'Community Service', 'QR Scan', 'Non-Compliance']
      : role === 'STUDENT' ? ['My Violations', 'My Service', 'My QR', 'My Clearance']
      : group.views
    return { id: group.id, label: group.label, icon: group.icon, type: 'group', items: views.map(page).filter(Boolean) }
  })

  return [page('Dashboard'), page(role === 'STUDENT' ? 'My Profile' : 'Students'), groups[0], page('Messages'), groups[1], groups[2]]
    .filter((entry) => entry && (entry.type === 'page' || entry.items.length > 0))
}

export const sidebarGroupForPath = (entries = [], path = '') =>
  entries.find((entry) => entry.type === 'group' && entry.items.some((item) => item.path === path))?.id || null

export const iconNameForView = (view = '') => ({
  Dashboard: 'dashboard', 'System Dashboard': 'monitoring', Students: 'students', 'My Profile': 'students', 'Assigned Students': 'students',
  'Duplicate Review': 'clearance', Violations: 'violations', 'My Violations': 'violations',
  'Community Service': 'service', 'My Service': 'service', 'Service Results': 'service', 'Active Attendance': 'clock', DTR: 'clock', Attendance: 'clock',
  'QR Scan': 'qr', 'My QR': 'qr', Clearance: 'clearance', 'My Clearance': 'clearance', Reports: 'reports',
  Messages: 'messages', Notifications: 'bell', 'Audit Log': 'clock', 'Account Settings': 'settings',
  'Departments & Officer Accounts': 'service', 'Non-Compliance': 'violations', 'Follow-up': 'violations'
}[view] || 'dashboard')

export const mobileNavItemsFor = (navItems = [], role = '') => [
  navItems.find(({ view }) => ['Dashboard', 'System Dashboard'].includes(view)),
  navItems.find(({ view }) => ['Students', 'Assigned Students', 'My Violations'].includes(view)),
  navItems.find(({ view }) => ['Violations', 'QR Scan', 'My Service'].includes(view)),
  navItems.find(({ view }) => role === 'DEPARTMENT_HEAD' ? view === 'Community Service' : view === 'Messages')
].filter(Boolean)

export const mobileNavLabel = (item = {}) => item.label === 'Service Results' ? 'Service' : String(item.label || '').replace('My ', '')
