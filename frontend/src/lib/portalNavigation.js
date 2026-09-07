export const iconNameForView = (view = '') => ({
  Dashboard: 'dashboard', Students: 'students', 'My Profile': 'students', 'Assigned Students': 'students',
  Registrations: 'registrations', 'Duplicate Review': 'clearance', Violations: 'violations', 'My Violations': 'violations',
  'Community Service': 'service', 'My Service': 'service', 'Service Results': 'service', DTR: 'clock', Attendance: 'clock',
  'QR Scan': 'qr', 'My QR': 'qr', Clearance: 'clearance', 'My Clearance': 'clearance', Reports: 'reports',
  Messages: 'messages', Notifications: 'bell', 'Audit Log': 'clock', 'Account Settings': 'settings',
  'Departments & Officer Accounts': 'service', 'Non-Compliance': 'violations', 'Follow-up': 'violations'
}[view] || 'dashboard')
