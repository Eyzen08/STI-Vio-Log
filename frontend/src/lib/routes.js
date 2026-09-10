export const ROLE_GROUPS = {
  administration: ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE'],
  department: ['DEPARTMENT_HEAD'],
  student: ['STUDENT']
}

export const PUBLIC_ROUTES = ['/login','/register','/verify-email','/forgot-password','/reset-password/verify','/reset-password/new','/privacy','/terms']

export const APP_ROUTES = [
  { path: '/system/dashboard', label: 'System Status', view: 'System Dashboard', roles: ['SYSTEM_ADMIN'] },
  { path: '/system/support-access', label: 'Support Access', view: 'Support Access', roles: ['SYSTEM_ADMIN'] },
  { path: '/system/notifications', label: 'Notifications', view: 'Notifications', roles: ['SYSTEM_ADMIN'], navigation: false },
  { path: '/system/account-settings', label: 'Account Settings', view: 'Account Settings', roles: ['SYSTEM_ADMIN'], navigation: false },
  { path: '/admin/dashboard', label: 'Dashboard', view: 'Dashboard', roles: ROLE_GROUPS.administration },
  { path: '/admin/account-settings', label: 'Account Settings', view: 'Account Settings', roles: ROLE_GROUPS.administration, navigation: false },
  { path: '/admin/students', label: 'Students', view: 'Students', roles: ROLE_GROUPS.administration },
  { path: '/admin/registrations', label: 'Registration & Duplicate Review', view: 'Registrations', roles: ROLE_GROUPS.administration },
  { path: '/admin/departments-officers', label: 'Departments & Officer Accounts', view: 'Departments & Officer Accounts', roles: ['DISCIPLINE_ADMIN'] },
  { path: '/admin/audit-log', label: 'Audit Log', view: 'Audit Log', roles: ['DISCIPLINE_ADMIN'] },
  { path: '/admin/duplicate-review', label: 'Duplicate Review', view: 'Registrations', roles: ['DISCIPLINE_ADMIN'], navigation: false, redirectTo: '/admin/registrations' },
  { path: '/admin/violations', label: 'Violations', view: 'Violations', roles: ROLE_GROUPS.administration },
  { path: '/admin/community-service', label: 'Community Service', view: 'Community Service', roles: ROLE_GROUPS.administration },
  { path: '/admin/qr-scan', label: 'QR Scan', view: 'QR Scan', roles: ROLE_GROUPS.administration },
  { path: '/admin/clearance', label: 'Clearance', view: 'Clearance', roles: ROLE_GROUPS.administration },
  { path: '/admin/reports', label: 'Reports', view: 'Reports', roles: ROLE_GROUPS.administration },
  { path: '/admin/messages', label: 'Messages', view: 'Messages', roles: ROLE_GROUPS.administration },
  { path: '/admin/notifications', label: 'Notifications', view: 'Notifications', roles: ROLE_GROUPS.administration },
  { path: '/admin/support-access', label: 'Support Access', view: 'Support Access', roles: ['DISCIPLINE_ADMIN'] },
  { path: '/department/dashboard', label: 'Dashboard', view: 'Dashboard', roles: ROLE_GROUPS.department },
  { path: '/department/account-settings', label: 'Account Settings', view: 'Account Settings', roles: ROLE_GROUPS.department, navigation: false },
  { path: '/department/students', label: 'Assigned Students', view: 'Students', roles: ROLE_GROUPS.department },
  { path: '/department/qr-scan', label: 'QR Scan', view: 'QR Scan', roles: ROLE_GROUPS.department },
  { path: '/department/community-service', label: 'Service Results', view: 'Community Service', roles: ROLE_GROUPS.department },
  { path: '/department/dtr', label: 'Attendance', view: 'DTR', roles: ROLE_GROUPS.department },
  { path: '/department/non-compliance', label: 'Follow-up', view: 'Non-Compliance', roles: ROLE_GROUPS.department },
  { path: '/department/reports', label: 'Reports', view: 'Reports', roles: ROLE_GROUPS.department },
  { path: '/department/messages', label: 'Messages', view: 'Messages', roles: ROLE_GROUPS.department },
  { path: '/department/notifications', label: 'Notifications', view: 'Notifications', roles: ROLE_GROUPS.department },
  { path: '/student/dashboard', label: 'Dashboard', view: 'Dashboard', roles: ROLE_GROUPS.student },
  { path: '/student/profile', label: 'My Profile', view: 'My Profile', roles: ROLE_GROUPS.student },
  { path: '/student/account-settings', label: 'Account Settings', view: 'Account Settings', roles: ROLE_GROUPS.student, navigation: false },
  { path: '/student/qr', label: 'My QR', view: 'My QR', roles: ROLE_GROUPS.student },
  { path: '/student/violations', label: 'My Violations', view: 'My Violations', roles: ROLE_GROUPS.student },
  { path: '/student/community-service', label: 'My Service', view: 'My Service', roles: ROLE_GROUPS.student },
  { path: '/student/notifications', label: 'Notifications', view: 'Notifications', roles: ROLE_GROUPS.student },
  { path: '/student/messages', label: 'Messages', view: 'Messages', roles: ROLE_GROUPS.student },
  { path: '/student/clearance', label: 'My Clearance', view: 'My Clearance', roles: ROLE_GROUPS.student }
]

const HOME_PATHS = {
  SYSTEM_ADMIN: '/system/dashboard',
  DISCIPLINE_ADMIN: '/admin/dashboard',
  DISCIPLINE_OFFICE: '/admin/dashboard',
  DEPARTMENT_HEAD: '/department/dashboard',
  STUDENT: '/student/dashboard'
}

export const getHomePath = (role) => HOME_PATHS[role] || '/unauthorized'

export const getNavItems = (role) =>
  APP_ROUTES.filter((route) => route.roles.includes(role) && route.navigation !== false)

export const resolveRoute = (path, role) => {
  if (PUBLIC_ROUTES.includes(path)) return { status: 'public', route: null }
  if (path === '/unauthorized') return { status: 'unauthorized', route: null }

  const legacyAdminRoutes = ['/admin/department-accounts','/admin/accounts','/admin/departments']
  const normalizedPath = legacyAdminRoutes.includes(path) ? '/admin/departments-officers' : path
  const route = APP_ROUTES.find((candidate) => candidate.path === normalizedPath)

  if (!route) return { status: 'not_found', route: null }
  if (!route.roles.includes(role)) return { status: 'unauthorized', route }

  return { status: 'allowed', route, redirectTo: route.redirectTo || (normalizedPath !== path ? normalizedPath : null) }
}
