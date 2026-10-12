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
    ? [section('student-services','Student Services',['My Service','My QR','My Violations','My Clearance'])]
    : role === 'DEPARTMENT_HEAD'
      ? [section('daily-work','Daily Work',['QR Scan','Community Service','DTR','Students'])]
      : [section('student-records','Student Records',['Students','Violations']),section('attendance-service','Attendance & Service',['QR Scan','Active Attendance','Community Service']),section('clearance','Clearance',['Awaiting Clearance','Clearance'])]
  return [page('Dashboard'), page('STI Handbook'), ...sections, section('updates','Updates',['Messages','Notifications']),
    {...section('reports','Reporting',['Reports','Analytics & Trends']),type:'group',icon:'reports'},
    {...section('management','Administration',['Departments & Officer Accounts','Duplicate Review','Audit Log','System Dashboard']),type:'group',icon:'settings'},
    {...section('account','Account',[role==='STUDENT'?'My Profile':'Profile','Account Settings']),placement:'footer'}]
    .filter((entry) => entry && (entry.type === 'page' || entry.items.length > 0))
}

export const sidebarGroupForPath = (entries = [], path = '') =>
  entries.find((entry) => entry.type === 'group' && entry.items.some((item) => item.path === path))?.id || null

const SIDEBAR_TOOLTIPS = {
  Dashboard: 'View Discipline Overview',
  'STI Handbook': 'Read the STI Student Handbook',
  Students: 'Manage Student Records',
  Violations: 'Add Student Violation',
  'Active Attendance': 'Monitor Active Attendance',
  'Community Service': 'Manage Community Service',
  'QR Scan': 'Scan Attendance QR Code',
  Clearance: 'Manage Student Clearance',
  'Awaiting Clearance': 'Approve Completed Community Service',
  Messages: 'View Student Messages',
  Notifications: 'View Your Notifications',
  Reports: 'Generate Discipline Reports',
  Reporting: 'View Reports and Analytics',
  Administration: 'Manage Administration Tools',
  Logout: 'Sign Out of STI Vio-Log',
  'Departments & Officer Accounts': 'Manage Departments and Officers',
  'Duplicate Review': 'Review Duplicate Records',
  'System Monitoring': 'Monitor System Activity',
  Settings: 'Configure System Settings',
  'Assigned Students': 'View Assigned Student Records',
  Attendance: 'Review Attendance Records',
  'Service Results': 'Review Service Results',
  'My Profile': 'View Your Profile',
  Profile: 'View Your Profile',
  'My Violations': 'View Your Violations',
  'My Service': 'View Your Service Progress',
  'My QR': 'View Your QR Code',
  'My Clearance': 'View Your Clearance',
  'Audit Log': 'Review Discipline Audit Log',
  'Analytics & Trends': 'Explore Discipline Trends'
}

export const sidebarTooltipFor = (label) => SIDEBAR_TOOLTIPS[label]

export const iconNameForView = (view = '') => ({
  'STI Handbook': 'book',
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
