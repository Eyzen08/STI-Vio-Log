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
