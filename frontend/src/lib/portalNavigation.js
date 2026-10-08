import { APP_ROUTES, getNavItems } from './routes.js'

// Sidebar presentation is separate from route protection and mobile shortcuts.
export const sidebarNavigationFor = (role = '') => {
  const items = getNavItems(role)
  items.push(...APP_ROUTES.filter(route => route.roles.includes(role) && ['Profile','Account Settings'].includes(route.view)).map(route => ({...route,label:route.view==='Account Settings'?'Settings':route.label})))

  const page = (view) => {
    const item = items.find((candidate) => candidate.view === view)
    return item ? { ...item, type: 'page' } : null
  }
  const section = (id,label,views) => ({id,label,type:'section',items:views.map(page).filter(Boolean)})
  const sections = role === 'STUDENT'
    ? [section('student-services','Student services',['My Service','My QR','My Violations','My Clearance'])]
    : role === 'DEPARTMENT_HEAD'
      ? [section('daily-work','Daily work',['QR Scan','Community Service','DTR','Students'])]
      : [section('student-records','Student records',['Students','Violations']),section('attendance-service','Attendance & service',['QR Scan','Active Attendance','Community Service']),section('clearance','Clearance',['Awaiting Clearance','Clearance'])]
  return [page('Dashboard'), ...sections, section('updates','Updates',['Messages','Notifications']),
    {...section('reports','Reporting',['Reports','Analytics & Trends']),type:'group',icon:'reports'},
    {...section('management','Administration',['Departments & Officer Accounts','Duplicate Review','Audit Log','System Dashboard']),type:'group',icon:'settings'},
    {...section('account','Account',[role==='STUDENT'?'My Profile':'Profile','Account Settings']),placement:'footer'}]
    .filter((entry) => entry && (entry.type === 'page' || entry.items.length > 0))
}

export const sidebarGroupForPath = (entries = [], path = '') =>
  entries.find((entry) => entry.type === 'group' && entry.items.some((item) => item.path === path))?.id || null

const SIDEBAR_TOOLTIPS = {
  Dashboard: 'View discipline overview',
  Students: 'Manage student records',
  Violations: 'Add student violation',
  'Active Attendance': 'Monitor active attendance',
  'Community Service': 'Manage community service',
  'QR Scan': 'Scan attendance QR code',
  Clearance: 'Manage student clearance',
  'Awaiting Clearance': 'Approve completed community service',
  Messages: 'View student messages',
  Notifications: 'View your notifications',
  Reports: 'Generate discipline reports',
  Reporting: 'View reports and analytics',
  Administration: 'Manage administration tools',
  Logout: 'Sign out of STI Vio-Log',
  'Departments & Officer Accounts': 'Manage departments and officers',
  'Duplicate Review': 'Review duplicate records',
  'System Monitoring': 'Monitor system activity',
  Settings: 'Configure system settings',
  'Assigned Students': 'View assigned student records',
  Attendance: 'Review attendance records',
  'Service Results': 'Review service results',
  'My Profile': 'View your profile',
  Profile: 'View your profile',
  'My Violations': 'View your violations',
  'My Service': 'View your service progress',
  'My QR': 'View your QR code',
  'My Clearance': 'View your clearance',
  'Audit Log': 'Review discipline audit log',
  'Analytics & Trends': 'Explore discipline trends'
}

export const sidebarTooltipFor = (label) => SIDEBAR_TOOLTIPS[label]

export const iconNameForView = (view = '') => ({
  Dashboard: 'dashboard', 'System Dashboard': 'monitoring', Students: 'students', Profile:'user', 'My Profile': 'user', 'Assigned Students': 'students',
  'Duplicate Review': 'clearance', Violations: 'violations', 'My Violations': 'violations',
  'Community Service': 'service', 'My Service': 'service', 'Service Results': 'service', 'Active Attendance': 'clock', DTR: 'clock', Attendance: 'clock',
  'QR Scan': 'qr', 'My QR': 'qr', Clearance: 'clearance', 'Awaiting Clearance': 'check', 'My Clearance': 'clearance', Reports: 'reports', 'Analytics & Trends': 'reports',
  Messages: 'messages', Notifications: 'bell', 'Audit Log': 'clock', 'Account Settings': 'settings',
  'Departments & Officer Accounts': 'service'
}[view] || 'dashboard')

export const mobileNavItemsFor = (navItems = [], role = '') => role === 'DEPARTMENT_HEAD'
  ? ['Dashboard', 'QR Scan', 'Community Service', 'DTR'].map(view => navItems.find(item => item.view === view)).filter(Boolean)
  : [
  navItems.find(({ view }) => ['Dashboard', 'System Dashboard'].includes(view)),
  navItems.find(({ view }) => role === 'STUDENT' ? view === 'My Service' : ['Students', 'Assigned Students'].includes(view)),
  navItems.find(({ view }) => role === 'STUDENT' ? view === 'My QR' : ['Violations', 'QR Scan'].includes(view)),
  navItems.find(({ view }) => role === 'DEPARTMENT_HEAD' ? view === 'Community Service' : view === 'Messages')
].filter(Boolean)

export const mobileNavLabel = (item = {}) => item.path?.startsWith('/department/')
  ? ({ Dashboard:'Home', 'QR Scan':'Scan', 'Community Service':'Service', DTR:'Attendance' }[item.view] || item.label)
  : item.view === 'Dashboard' && item.path?.startsWith('/student/') ? 'Home' : String(item.label || '').replace('My ', '')
