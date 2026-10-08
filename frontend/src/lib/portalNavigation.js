import { APP_ROUTES, getNavItems } from './routes.js'

const SIDEBAR_GROUPS = [
  { id: 'discipline', label: 'Discipline', icon: 'violations', views: ['Violations', 'Active Attendance', 'Community Service', 'QR Scan', 'Clearance', 'Awaiting Clearance'] },
  { id: 'reports', label: 'Reports', icon: 'reports', views: ['Reports', 'Audit Log', 'Analytics & Trends'] },
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

  return [page('Dashboard'), page(role === 'STUDENT' ? 'My Profile' : 'Students'), groups[0], page('Messages'), page('Notifications'), groups[1], groups[2]]
    .filter((entry) => entry && (entry.type === 'page' || entry.items.length > 0))
}

export const sidebarGroupForPath = (entries = [], path = '') =>
  entries.find((entry) => entry.type === 'group' && entry.items.some((item) => item.path === path))?.id || null

const SIDEBAR_TOOLTIPS = {
  Dashboard: 'View discipline overview',
  Students: 'Manage student records',
  Discipline: 'View discipline modules',
  Violations: 'Add student violation',
  'Active Attendance': 'Monitor active attendance',
  'Community Service': 'Manage community service',
  'QR Scan': 'Scan attendance QR code',
  Clearance: 'Manage student clearance',
  'Awaiting Clearance': 'Approve completed community service',
  Messages: 'View student messages',
  Notifications: 'View your notifications',
  Reports: 'Generate discipline reports',
  'System & Management': 'Manage system settings',
  Logout: 'Sign out of STI Vio-Log',
  'Departments & Officer Accounts': 'Manage departments and officers',
  'Duplicate Review': 'Review duplicate records',
  'System Monitoring': 'Monitor system activity',
  Settings: 'Configure system settings',
  'Assigned Students': 'View assigned student records',
  Attendance: 'Review attendance records',
  'Service Results': 'Review service results',
  'Follow-up': 'Review non-compliance follow-ups',
  'My Profile': 'View your profile',
  'My Violations': 'View your violations',
  'My Service': 'View your service progress',
  'My QR': 'View your QR code',
  'My Clearance': 'View your clearance',
  'Audit Log': 'Review discipline audit log',
  'Analytics & Trends': 'Explore discipline trends'
}

export const sidebarTooltipFor = (label) => SIDEBAR_TOOLTIPS[label]

export const iconNameForView = (view = '') => ({
  Dashboard: 'dashboard', 'System Dashboard': 'monitoring', Students: 'students', 'My Profile': 'students', 'Assigned Students': 'students',
  'Duplicate Review': 'clearance', Violations: 'violations', 'My Violations': 'violations',
  'Community Service': 'service', 'My Service': 'service', 'Service Results': 'service', 'Active Attendance': 'clock', DTR: 'clock', Attendance: 'clock',
  'QR Scan': 'qr', 'My QR': 'qr', Clearance: 'clearance', 'Awaiting Clearance': 'check', 'My Clearance': 'clearance', Reports: 'reports', 'Analytics & Trends': 'reports',
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
