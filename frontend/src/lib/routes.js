export const ROLE_GROUPS = {
  administration: ['ADMIN', 'DISCIPLINE_OFFICE'],
  department: ['DEPARTMENT_HEAD'],
  student: ['STUDENT']
}

export const APP_ROUTES = [
  { path: '/admin/dashboard', label: 'Dashboard', view: 'Dashboard', roles: ROLE_GROUPS.administration },
  { path: '/admin/students', label: 'Students', view: 'Students', roles: ROLE_GROUPS.administration },
  { path: '/admin/registrations', label: 'Registrations', view: 'Registrations', roles: ROLE_GROUPS.administration },
  { path: '/admin/department-accounts', label: 'Department Accounts', view: 'Department Accounts', roles: ['ADMIN'] },
  { path: '/admin/accounts', label: 'Staff Accounts', view: 'Accounts', roles: ['ADMIN'] },
  { path: '/admin/departments', label: 'Departments', view: 'Departments', roles: ['ADMIN'] },
  { path: '/admin/audit-log', label: 'Audit Log', view: 'Audit Log', roles: ['ADMIN'] },
  { path: '/admin/duplicate-review', label: 'Duplicate Review', view: 'Duplicate Review', roles: ['ADMIN'] },
  { path: '/admin/violations', label: 'Violations', view: 'Violations', roles: ROLE_GROUPS.administration },
  { path: '/admin/community-service', label: 'Community Service', view: 'Community Service', roles: ROLE_GROUPS.administration },
  { path: '/admin/qr-scan', label: 'QR Scan', view: 'QR Scan', roles: ROLE_GROUPS.administration },
  { path: '/admin/clearance', label: 'Clearance', view: 'Clearance', roles: ROLE_GROUPS.administration },
  { path: '/admin/reports', label: 'Reports', view: 'Reports', roles: ROLE_GROUPS.administration },
  { path: '/admin/messages', label: 'Messages', view: 'Messages', roles: ROLE_GROUPS.administration },
  { path: '/department/qr-scan', label: 'QR Scan', view: 'QR Scan', roles: ROLE_GROUPS.department },
  { path: '/department/community-service', label: 'Service Results', view: 'Community Service', roles: ROLE_GROUPS.department },
  { path: '/student/dashboard', label: 'Dashboard', view: 'Dashboard', roles: ROLE_GROUPS.student },
  { path: '/student/profile', label: 'My Profile', view: 'My Profile', roles: ROLE_GROUPS.student },
  { path: '/student/qr', label: 'My QR', view: 'My QR', roles: ROLE_GROUPS.student },
  { path: '/student/violations', label: 'My Violations', view: 'My Violations', roles: ROLE_GROUPS.student },
  { path: '/student/community-service', label: 'My Service', view: 'My Service', roles: ROLE_GROUPS.student },
  { path: '/student/notifications', label: 'Notifications', view: 'Notifications', roles: ROLE_GROUPS.student },
  { path: '/student/messages', label: 'Messages', view: 'Messages', roles: ROLE_GROUPS.student },
  { path: '/student/clearance', label: 'My Clearance', view: 'My Clearance', roles: ROLE_GROUPS.student }
]

const HOME_PATHS = {
  ADMIN: '/admin/dashboard',
  DISCIPLINE_OFFICE: '/admin/dashboard',
  DEPARTMENT_HEAD: '/department/qr-scan',
  STUDENT: '/student/dashboard'
}

export const getHomePath = (role) => HOME_PATHS[role] || '/unauthorized'

export const getNavItems = (role) =>
  APP_ROUTES.filter((route) => route.roles.includes(role))

export const resolveRoute = (path, role) => {
  if (['/login','/register','/verify-email','/forgot-password','/reset-password/verify','/reset-password/new'].includes(path)) return { status: 'public', route: null }
  if (path === '/unauthorized') return { status: 'unauthorized', route: null }

  const route = APP_ROUTES.find((candidate) => candidate.path === path)

  if (!route) return { status: 'not_found', route: null }
  if (!route.roles.includes(role)) return { status: 'unauthorized', route }

  return { status: 'allowed', route }
}
