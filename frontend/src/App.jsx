import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { cameraUnavailableMessage, scannerQrBox } from './lib/departmentScanner.js'
const LoginPage = lazy(() => import('./components/LoginPage.jsx'))
const DepartmentDashboard = lazy(() => import('./components/DepartmentDashboard.jsx'))
const DepartmentCommunityService = lazy(() => import('./components/DepartmentCommunityService.jsx'))
const DepartmentQrScanner = lazy(() => import('./components/DepartmentQrScanner.jsx'))
const DepartmentReports = lazy(() => import('./components/DepartmentReports.jsx'))
import DepartmentDtr from './components/DepartmentDtr.jsx'
import DepartmentNonCompliance from './components/DepartmentNonCompliance.jsx'
import DepartmentStudents from './components/DepartmentStudents.jsx'
const StudentAccountActions = lazy(() => import('./components/StudentAccountActions.jsx'))
import GuardianContactPanel from './components/GuardianContactPanel.jsx'
const Modal = lazy(() => import('./components/Modal.jsx'))
import RouteStatePage from './components/RouteStatePage.jsx'
import RouteErrorBoundary from './components/RouteErrorBoundary.jsx'
const StudentDashboard = lazy(() => import('./components/StudentDashboard.jsx'))
const StudentCommunityService = lazy(() => import('./components/StudentCommunityService.jsx'))
const StudentClearance = lazy(() => import('./components/StudentClearance.jsx'))
const StudentNotifications = lazy(() => import('./components/StudentNotifications.jsx'))
const MessagesPage = lazy(() => import('./components/MessagesPage.jsx'))
const StudentProfile = lazy(() => import('./components/StudentProfile.jsx'))
const StudentQr = lazy(() => import('./components/StudentQr.jsx'))
const StudentViolations = lazy(() => import('./components/StudentViolations.jsx'))
const AdminRegistrationReviewWorkspace = lazy(() => import('./components/AdminRegistrationReviewWorkspace.jsx'))
const PasswordChangeRequired = lazy(() => import('./components/PasswordChangeRequired.jsx'))
const AdminAuditLog = lazy(() => import('./components/AdminAuditLog.jsx'))
const AdminDepartmentOfficers = lazy(() => import('./components/AdminDepartmentOfficers.jsx'))
const AdminAccountSettings = lazy(() => import('./components/AdminAccountSettings.jsx'))
const AdminClearanceCertificates = lazy(() => import('./components/AdminClearanceCertificates.jsx'))
import OffenseIndicator from './components/OffenseIndicator.jsx'
const AccountSecuritySettings = lazy(() => import('./components/AccountSecuritySettings.jsx'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard.jsx'))
const SystemDashboard = lazy(() => import('./components/SystemDashboard.jsx'))
const SupportAccessPanel = lazy(() => import('./components/SupportAccessPanel.jsx'))
import PortalIcon from './components/PortalIcon.jsx'
import ProfileMenu from './components/ProfileMenu.jsx'
const PublicPolicyPage = lazy(() => import('./components/PublicPolicyPage.jsx'))
import { API_URL, login } from './lib/api.js'
import { getHomePath, getNavItems, resolveRoute } from './lib/routes.js'
import { buildDepartmentDtrQuery } from './lib/departmentDtr.js'
import { nonComplianceSortQuery } from './lib/departmentNonCompliance.js'
import { buildViolationPayload, buildViolationUpdatePayload, offensesForType, selectedViolationType, studentIdFromSearch, studentOptionLabel } from './lib/violationAdmin.js'
import stiVioLogLogo from './assets/sti-vio-log-logo-web.png'
import { clearSession, loadSession, saveSession } from './lib/session.js'
import { filterAdminStudents, handbookSanctionGuidance, summarizeStudentCondition } from './lib/adminStudentReview.js'
import { buildAdminReportQuery, defaultReportSort, reportSortOptions } from './lib/adminReports.js'
import { formatPendingRegistrationCount, pendingRegistrationCount } from './lib/pendingRegistrations.js'
import { buildCommunityServiceAssignmentPayload, communityServiceStudentLabel, communityServiceViolationLabel, eligibleServiceViolations, headsForDepartment, resolveCommunityServiceStudent, serviceDepartmentOptions } from './lib/communityServiceAdmin.js'
import { createDepartmentReportCsv } from './lib/departmentReports.js'
import { reportCell, reportColumnLabel, presentedReportRows } from './lib/reportPresentation.js'
import { formatUnreadMessageCount, unreadMessageCount } from './lib/messageUnread.js'
import { connectRealtime } from './lib/realtime.js'
import { formatDuration, formatIncidentDateTime, formatManilaDateTime } from './lib/displayFormat.js'
import { iconNameForView } from './lib/portalNavigation.js'
import { applyPageMetadata, metadataForRoute } from './lib/pageMetadata.js'
import './App.css'
import './styles/portal-system.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function App() {
  const [initialSession] = useState(loadSession)
  const [qrScanner, setQrScanner] = useState(null)
  const [isQrScanning, setIsQrScanning] = useState(false)
  const [qrFacingMode, setQrFacingMode] = useState('environment')
  const qrDecodeBusyRef = useRef(false)
  const qrActionBusyRef = useRef(false)

  /*
   * IMPORTANT:
   * Username and password are intentionally EMPTY.
   * This prevents the application itself from automatically
   * inserting admin/password into the login fields.
   */
  const [form, setForm] = useState({
    username: '',
    password: ''
  })

  const [routePath, setRoutePath] = useState(() => window.location.pathname)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [activeView, setActiveView] = useState('Dashboard')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [token, setToken] = useState(initialSession.token)
  const [user, setUser] = useState(initialSession.user)

  const [students, setStudents] = useState([])
  const [violations, setViolations] = useState([])
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0)
  const [studentProfile, setStudentProfile] = useState(null)
  const [clearanceEligibility, setClearanceEligibility] = useState(null)
  const [clearanceCertificate, setClearanceCertificate] = useState(null)
  const [clearanceCertificateError, setClearanceCertificateError] = useState('')
  const [departmentDtr, setDepartmentDtr] = useState(null)
  const [departmentDtrLoading, setDepartmentDtrLoading] = useState(false)
  const [departmentDtrError, setDepartmentDtrError] = useState('')
  const [departmentNonCompliance, setDepartmentNonCompliance] = useState(null)
  const [departmentNonComplianceLoading, setDepartmentNonComplianceLoading] = useState(false)
  const [departmentNonComplianceError, setDepartmentNonComplianceError] = useState('')
  const [departmentNonComplianceSort, setDepartmentNonComplianceSort] = useState('date')
  const [studentDtr, setStudentDtr] = useState(null)
  const [studentDtrLoading, setStudentDtrLoading] = useState(false)
  const [studentDtrError, setStudentDtrError] = useState('')
  const [studentNotifications, setStudentNotifications] = useState([])
  const [activeServiceSessions, setActiveServiceSessions] = useState([])
  const [notificationActionError, setNotificationActionError] = useState('')
  const [pendingAccountCounts, setPendingAccountCounts] = useState({ students: 0, departments: 0 })
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [realtimeSocket, setRealtimeSocket] = useState(null)

  useEffect(() => {
    if (!token || user?.password_change_required) {
      setRealtimeSocket(null)
      return undefined
    }
    const socket = connectRealtime(token)
    setRealtimeSocket(socket)
    return () => { socket.disconnect() }
  }, [token, user?.password_change_required])

  useEffect(() => {
    if (!realtimeSocket) return undefined
    const refreshServiceData = () => setDashboardRefreshKey((current) => current + 1)
    realtimeSocket.on('community-service:changed', refreshServiceData)
    realtimeSocket.on('notifications:changed', refreshServiceData)
    return () => {
      realtimeSocket.off('community-service:changed', refreshServiceData)
      realtimeSocket.off('notifications:changed', refreshServiceData)
    }
  }, [realtimeSocket])

  const markNotificationRead = async (notificationId) => {
    setNotificationActionError('')
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Unable to mark this notification as read.')
      setStudentNotifications((items) => items.map((item) => Number(item.id) === Number(notificationId)
        ? { ...item, is_read: true, read_at: data.notification?.read_at || new Date().toISOString() }
        : item))
    } catch (error) {
      setNotificationActionError(error.message)
    }
  }

  const acknowledgeNotification = async (notificationId) => {
    setNotificationActionError('')
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/acknowledge`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Unable to acknowledge this security notification.')
      setStudentNotifications((items) => items.map((item) => Number(item.id) === Number(notificationId)
        ? { ...item, is_read: true, read_at: data.notification?.read_at, acknowledged_at: data.notification?.acknowledged_at }
        : item))
    } catch (error) {
      setNotificationActionError(error.message)
    }
  }

  const loadClearanceCertificate = async () => {
    setClearanceCertificateError('')
    try {
      const response = await fetch(`${API_URL}/api/student/clearance/certificate`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Unable to prepare your certificate.')
      setClearanceCertificate(data.certificate)
    } catch (error) {
      setClearanceCertificate(null)
      setClearanceCertificateError(error.message)
    }
  }

  const [studentForm, setStudentForm] = useState({
    student_number: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    suffix: '',
    email: '',
    phone_number: '',
    program: '',
    section: '',
    year_level: 1,
    qr_code: '',
    profile_image: ''
  })

  const [studentFormError, setStudentFormError] = useState('')
  const [studentFormSuccess, setStudentFormSuccess] = useState('')
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false)
  const [studentRosterSearch, setStudentRosterSearch] = useState('')
  const [reviewedStudent, setReviewedStudent] = useState(null)
  const [reportPage, setReportPage] = useState(1)
  const [reportGenerated, setReportGenerated] = useState(false)
  const [reviewedStudentViolations, setReviewedStudentViolations] = useState([])
  const [reviewedStudentPage, setReviewedStudentPage] = useState(1)
  const [reviewedStudentHasMore, setReviewedStudentHasMore] = useState(false)
  const [reviewedStudentSummary, setReviewedStudentSummary] = useState(null)
  const [reviewedStudentLoading, setReviewedStudentLoading] = useState(false)
  const [reviewedStudentError, setReviewedStudentError] = useState('')
  const [guardianContactStudent, setGuardianContactStudent] = useState(null)

  const [violationForm, setViolationForm] = useState({
    student_id: '',
    student_search: '',
    violation_type_id: '',
    incident_date: '',
    incident_time: '',
    exact_offense: '',
    incident_details: '',
  })
  const [violationTypes, setViolationTypes] = useState([])
  const [editingViolation, setEditingViolation] = useState(null)
  const [viewingViolation, setViewingViolation] = useState(null)
  const [violationEditForm, setViolationEditForm] = useState({description:'',reason:''})
  const [violationEditError, setViolationEditError] = useState('')

  const [violationFormError, setViolationFormError] = useState('')
  const [violationFormSuccess, setViolationFormSuccess] = useState('')
  const [isViolationFormOpen, setIsViolationFormOpen] = useState(false)
  const [violationTableFilters, setViolationTableFilters] = useState({ search: '', status: 'ALL', severity: 'ALL' })

  const [communityServiceAssignments, setCommunityServiceAssignments] =
    useState([])
  const [communityServiceDestinations, setCommunityServiceDestinations] = useState([])

  const [communityServiceForm, setCommunityServiceForm] = useState({
    violation_id: '',
    student_id: '',
    student_search: '',
    required_hours: '',
    required_minutes: '',
    department_id: '',
    department_head_id: ''
  })

  const [communityServiceFormError, setCommunityServiceFormError] =
    useState('')

  const [communityServiceFormSuccess, setCommunityServiceFormSuccess] =
    useState('')
  const [isCommunityServiceFormOpen, setIsCommunityServiceFormOpen] = useState(false)
  const [viewingServiceAssignment, setViewingServiceAssignment] = useState(null)
  const [serviceTableFilters, setServiceTableFilters] = useState({ search: '', status: 'ALL', department: 'ALL' })

  const [qrForm, setQrForm] = useState({
    qr_code: '',
    department_id: '',
    supervising_officer_id: '',
    notes: '',
    condition: ''
  })

  const [qrError, setQrError] = useState('')
  const [qrResult, setQrResult] = useState(null)
  const [verifiedQr, setVerifiedQr] = useState('')
  const [qrSubmitting, setQrSubmitting] = useState(false)
  const [recentQrScans, setRecentQrScans] = useState([])

  const [clearanceRecords, setClearanceRecords] = useState([])

  const [reportType, setReportType] = useState('violations')
  const [reportData, setReportData] = useState([])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')
  const [activeSupportGrant, setActiveSupportGrant] = useState(null)

  const [reportFilters, setReportFilters] = useState({
    search: '',
    status: '',
    student_id: '',
    from_date: '',
    to_date: '',
    sort_by: 'date_desc'
  })

  const isLoggedIn = Boolean(user)

  const navItems = getNavItems(user?.role)

  const navGroupName = (item) => {
    if (item.view === 'Dashboard') return 'Overview'
    if (['Students','Registrations','Duplicate Review','My Profile','My QR','My Violations','My Service','My Clearance','Notifications','Assigned Students'].includes(item.view)) return user?.role === 'STUDENT' ? 'My portal' : 'Students'
    if (['Violations','Community Service','QR Scan','Clearance','DTR','Non-Compliance','Service Results','Attendance','Follow-up'].includes(item.view)) return 'Discipline'
    if (['Departments & Officer Accounts','Support Access'].includes(item.view)) return 'Management'
    if (item.view === 'Messages') return 'Communication'
    if (['Reports','Audit Log'].includes(item.view)) return 'Reports'
    return 'Account'
  }

  const markAllNotificationsRead = async (category = 'ALL') => {
    setNotificationActionError('')
    try {
      const response = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Unable to mark notifications as read.')
      setStudentNotifications((items) => items.map((item) => category === 'ALL' || item.category === category ? { ...item, is_read: true, read_at: new Date().toISOString() } : item))
    } catch (error) { setNotificationActionError(error.message) }
  }

  const navGroups = navItems.filter((item) => item.view !== 'Account Settings').reduce((groups, item) => {
    const name = navGroupName(item)
    const group = groups.find((candidate) => candidate.name === name)
    if (group) group.items.push(item)
    else groups.push({ name, items: [item] })
    return groups
  }, [])

  const mobileNavItems = [
    navItems.find(({ view }) => ['Dashboard', 'System Dashboard'].includes(view)),
    navItems.find(({ view }) => ['Students','Assigned Students','My Violations'].includes(view)),
    navItems.find(({ view }) => ['Violations','QR Scan','My Service'].includes(view)),
    navItems.find(({ view }) => view === 'Messages')
  ].filter(Boolean)

  const userRole = user?.role || null

  const isAdmin =
    userRole === 'DISCIPLINE_ADMIN' ||
    userRole === 'DISCIPLINE_OFFICE'

  const isDepartmentHead =
    userRole === 'DEPARTMENT_HEAD'

  const isStudent =
    userRole === 'STUDENT'

  const routeResolution = resolveRoute(routePath, userRole)

  useEffect(() => {
    applyPageMetadata(metadataForRoute(routePath, routeResolution.route?.label))
  }, [routePath, routeResolution.route?.label])

  useEffect(() => {
    if (!token || userRole !== 'SYSTEM_ADMIN') { setActiveSupportGrant(null); return undefined }
    const controller = new AbortController()
    const refresh = () => fetch(`${API_URL}/api/support-access`, { headers:{Authorization:`Bearer ${token}`}, signal:controller.signal })
      .then((response)=>response.ok?response.json():null)
      .then((data)=>setActiveSupportGrant((data?.requests||[]).find((item)=>item.status==='APPROVED' && new Date(item.expires_at)>new Date())||null))
      .catch((loadError)=>{if(loadError.name!=='AbortError')setActiveSupportGrant(null)})
    refresh()
    const timer=window.setInterval(refresh,30000)
    return ()=>{window.clearInterval(timer);controller.abort()}
  },[token,userRole])

  useEffect(() => {
    if (!isMobileNavOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsMobileNavOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isMobileNavOpen])
  const updatePendingStudentCount = useCallback((students) => {
    setPendingAccountCounts((current) => ({ ...current, students }))
  }, [])
  const updateUnreadMessages = useCallback((count) => setUnreadMessages(Math.max(0, Number(count) || 0)), [])

  useEffect(() => {
    if (!isLoggedIn || !token) {
      setUnreadMessages(0)
      return undefined
    }
    const controller = new AbortController()
    const refresh = async () => {
      try {
        const response = await fetch(`${API_URL}/api/messages/conversations`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
        })
        const data = await response.json().catch(() => ({}))
        if (response.ok) setUnreadMessages(Number(data.unread_total ?? unreadMessageCount(data.conversations)))
      } catch (loadError) {
        if (loadError.name !== 'AbortError') return
      }
    }
    refresh()
    const handleMessageChange = () => refresh()
    realtimeSocket?.on('messages:changed', handleMessageChange)
    const interval = window.setInterval(refresh, 30000)
    return () => { controller.abort(); window.clearInterval(interval); realtimeSocket?.off('messages:changed', handleMessageChange) }
  }, [isLoggedIn, token, realtimeSocket])

  useEffect(() => {
    if (!token || !isAdmin) {
      setPendingAccountCounts({ students: 0, departments: 0 })
      return undefined
    }

    const controller = new AbortController()
    const headers = { Authorization: `Bearer ${token}` }
    const requests = [fetch(`${API_URL}/api/google-registrations?status=PENDING&limit=100`, { headers, signal: controller.signal })]

    Promise.all(requests)
      .then((responses) => Promise.all(responses.map(async (response) => response.ok ? response.json() : null)))
      .then(([studentsData]) => {
        setPendingAccountCounts({
          students: pendingRegistrationCount(studentsData),
          departments: 0
        })
      })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setPendingAccountCounts({ students: 0, departments: 0 })
      })

    return () => controller.abort()
  }, [token, isAdmin, userRole])

  const navigateTo = (path, { replace = false } = {}) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setRoutePath(path)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  useEffect(() => {
    const handlePopState = () => setRoutePath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!isLoggedIn) {
      if (routePath === '/' || routeResolution.status === 'unauthorized') navigateTo('/login', { replace: true })
      return
    }

    if (user?.password_change_required) {
      if (routePath !== '/account/password-change') navigateTo('/account/password-change', { replace: true })
      return
    }

    if (routePath === '/' || routePath === '/login') {
      navigateTo(getHomePath(userRole), { replace: true })
      return
    }

    if (routeResolution.status === 'allowed') {
      if (routeResolution.redirectTo) {
        navigateTo(routeResolution.redirectTo, { replace: true })
        return
      }
      setActiveView(routeResolution.route.view)
    }
  }, [isLoggedIn, routePath, routeResolution.redirectTo, routeResolution.route, routeResolution.status, user, userRole])

  const openViolationsCount = violations.filter(
    (violation) =>
      ['OPEN', 'IN_PROGRESS'].includes(violation.status)
  ).length

  const totalStudents = students.length

  const pendingViolations = violations.filter(
    (violation) =>
      ['OPEN', 'IN_PROGRESS'].includes(violation.status)
  ).length

  const studentsOnService = communityServiceAssignments.filter(
    (assignment) =>
      ['OPEN', 'IN_PROGRESS'].includes(
        assignment.status || 'OPEN'
      )
  ).length

  const clearedViolations = violations.filter(
    (violation) =>
      violation.status === 'CLEARED'
  ).length

  const goodStandingStudents = Math.max(
    0,
    totalStudents - pendingViolations
  )

  const dashboardStats = [
    {
      label: 'Total Students',
      value: totalStudents
    },
    {
      label: 'Open Violations',
      value: openViolationsCount
    },
    {
      label: 'Pending Violations',
      value: pendingViolations
    },
    {
      label: 'Students on Community Service',
      value: studentsOnService
    },
    {
      label: 'Non-Compliant Students',
      value: Math.max(0, pendingViolations)
    },
    {
      label: 'Cleared Students',
      value: clearedViolations
    },
    {
      label: 'Good Standing Students',
      value: goodStandingStudents
    }
  ]

  /*
   * ============================================================
   * LOAD DASHBOARD DATA
   * ============================================================
   */

  useEffect(() => {
    if (!isLoggedIn || !token || !userRole) {
      setStudents([])
      setViolations([])
      setCommunityServiceAssignments([])
      setClearanceRecords([])
      setStudentProfile(null)
      setClearanceEligibility(null)
      setClearanceCertificate(null)
      setClearanceCertificateError('')
      setDashboardError('')
      setDepartmentDtr(null)
      setStudentDtr(null)
      setStudentDtrError('')
      setStudentNotifications([])
      setActiveServiceSessions([])
      return
    }

    const loadDashboardData = async () => {
      setDashboardLoading(true)
      setDashboardError('')

      try {
        const authHeaders = {
          Authorization: `Bearer ${token}`
        }

        if (userRole === 'SYSTEM_ADMIN') {
          const notificationsResponse = await fetch(`${API_URL}/api/notifications?limit=100`, { headers: authHeaders })
          const notificationsData = await notificationsResponse.json().catch(() => ({}))
          if (!notificationsResponse.ok) throw new Error(notificationsData.message || 'Unable to load system notifications')
          setStudentNotifications(notificationsData.notifications || [])
          return
        }

        /*
         * ======================================================
         * ADMIN / DISCIPLINE OFFICE
         * ======================================================
         */

        if (isAdmin) {
          const [
            studentsResponse,
            violationsResponse,
            violationTypesResponse,
            assignmentsResponse,
            clearanceResponse,
            destinationsResponse,
            notificationsResponse,
            activeSessionsResponse
          ] = await Promise.all([
            fetch(`${API_URL}/api/students`, {
              headers: authHeaders
            }),

            fetch(`${API_URL}/api/violations?limit=100`, {
              headers: authHeaders
            }),

            fetch(`${API_URL}/api/violations/types`, {
              headers: authHeaders
            }),

            fetch(`${API_URL}/api/community-service`, {
              headers: authHeaders
            }),

            fetch(`${API_URL}/api/clearance`, {
              headers: authHeaders
            }),

            fetch(`${API_URL}/api/community-service/assignment-options`, {
              headers: authHeaders
            }),
            fetch(`${API_URL}/api/notifications?limit=100`, { headers: authHeaders }),
            fetch(`${API_URL}/api/community-service/active-sessions`, { headers: authHeaders })
          ])

          if (
            !studentsResponse.ok ||
            !violationsResponse.ok ||
            !violationTypesResponse.ok ||
            !assignmentsResponse.ok ||
            !clearanceResponse.ok ||
            !destinationsResponse.ok ||
            !notificationsResponse.ok ||
            !activeSessionsResponse.ok
          ) {
            throw new Error(
              'Unable to load administration data'
            )
          }

          const studentsData =
            await studentsResponse.json()

          const violationsData =
            await violationsResponse.json()

          const violationTypesData =
            await violationTypesResponse.json()

          const assignmentsData =
            await assignmentsResponse.json()

          const clearanceData =
            await clearanceResponse.json()

          const destinationsData = await destinationsResponse.json()
          const notificationsData = await notificationsResponse.json()
          const activeSessionsData = await activeSessionsResponse.json()

          setStudents(
            studentsData.students || []
          )

          setViolations(
            violationsData.violations || []
          )

          setViolationTypes(
            (violationTypesData.violationTypes || []).filter((type) =>
              type.violation_code.startsWith('HANDBOOK_')
            )
          )

          setCommunityServiceAssignments(
            assignmentsData.assignments || []
          )
          setCommunityServiceDestinations(destinationsData.destinations || [])
          setStudentNotifications(notificationsData.notifications || [])
          setActiveServiceSessions(activeSessionsData.sessions || [])

          setClearanceRecords(
            clearanceData.clearanceRecords || []
          )

          return
        }

        /*
         * ======================================================
         * DEPARTMENT HEAD
         * ======================================================
         */

        if (isDepartmentHead) {
          const [assignmentsResponse, notificationsResponse] = await Promise.all([
            fetch(`${API_URL}/api/community-service?limit=100`, { headers: authHeaders }),
            fetch(`${API_URL}/api/notifications?limit=100`, { headers: authHeaders })
          ])
          const assignmentsData = await assignmentsResponse.json().catch(() => ({}))
          const notificationsData = await notificationsResponse.json().catch(() => ({}))

          if (!assignmentsResponse.ok || !notificationsResponse.ok) throw new Error(assignmentsData.message || notificationsData.message || 'Unable to load assigned community service')

          setStudents([])
          setViolations([])
          setCommunityServiceAssignments(assignmentsData.assignments || [])
          setClearanceRecords([])
          setDepartmentDtr(null)
          setDepartmentNonCompliance(null)
          setStudentNotifications(notificationsData.notifications || [])

          return
        }

        /*
         * ======================================================
         * STUDENT
         * ======================================================
         */

        if (isStudent) {
          setStudents([])

          const responses = await Promise.all([
            fetch(`${API_URL}/api/students/me`, { headers: authHeaders }),
            fetch(`${API_URL}/api/students/me/violations`, { headers: authHeaders }),
            fetch(`${API_URL}/api/students/me/community-service`, { headers: authHeaders }),
            fetch(`${API_URL}/api/students/me/community-service/dtr`, { headers: authHeaders }),
            fetch(`${API_URL}/api/notifications?limit=100`, { headers: authHeaders }),
            fetch(`${API_URL}/api/student/clearance`, { headers: authHeaders }),
            fetch(`${API_URL}/api/student/clearance/eligibility`, { headers: authHeaders })
          ])

          const payloads = await Promise.all(responses.map((response) => response.json().catch(() => ({}))))
          const failedIndex = responses.findIndex((response) => !response.ok)

          if (failedIndex !== -1) {
            throw new Error(payloads[failedIndex].message || 'Unable to load your dashboard')
          }

          const [profileData, violationsData, assignmentsData, dtrData, notificationsData, clearanceData, eligibilityData] = payloads
          setStudentProfile(profileData.student || null)
          setViolations(violationsData.violations || [])
          setCommunityServiceAssignments(assignmentsData.assignments || [])
          setStudentDtr(dtrData)
          setStudentNotifications(notificationsData.notifications || [])
          setClearanceRecords(clearanceData.clearanceRecords || [])
          setClearanceEligibility(eligibilityData)

          return
        }
      } catch (fetchError) {
        console.error(
          'Dashboard data loading error:',
          fetchError
        )

        setStudents([])
        setViolations([])
        setCommunityServiceAssignments([])
        setClearanceRecords([])
        setStudentProfile(null)
        setClearanceEligibility(null)
        setClearanceCertificate(null)
        setClearanceCertificateError('')
        setDashboardError(fetchError.message || 'Unable to load dashboard data')
        setDepartmentDtr(null)
        setStudentDtr(null)
        setStudentNotifications([])
        setActiveServiceSessions([])
      } finally {
        setDashboardLoading(false)
      }
    }

    loadDashboardData()
  }, [
    isLoggedIn,
    token,
    userRole,
    isAdmin,
    isDepartmentHead,
    isStudent,
    user,
    dashboardRefreshKey
  ])

  const loadStudentDtr = async ({ from = '', to = '' } = {}) => {
    setStudentDtrLoading(true)
    setStudentDtrError('')
    try {
      const query = new URLSearchParams()
      if (from) query.set('from', from)
      if (to) query.set('to', to)
      const suffix = query.size ? `?${query}` : ''
      const response = await fetch(`${API_URL}/api/students/me/community-service/dtr${suffix}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Unable to load your DTR')
      setStudentDtr(data)
    } catch (dtrError) {
      setStudentDtrError(dtrError.message || 'Unable to load your DTR')
    } finally {
      setStudentDtrLoading(false)
    }
  }

  const loadDepartmentDtr = async (filters = {}) => {
    setDepartmentDtrLoading(true)
    setDepartmentDtrError('')
    try {
      const query = buildDepartmentDtrQuery(filters)
      const response = await fetch(`${API_URL}/api/reports/dtr${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Unable to load department DTR')
      setDepartmentDtr(data)
    } catch (dtrError) {
      setDepartmentDtrError(dtrError.message || 'Unable to load department DTR')
    } finally {
      setDepartmentDtrLoading(false)
    }
  }

  const loadDepartmentNonCompliance = async (sortBy) => {
    setDepartmentNonComplianceSort(sortBy)
    setDepartmentNonComplianceLoading(true)
    setDepartmentNonComplianceError('')
    try {
      const query = nonComplianceSortQuery(sortBy)
      const response = await fetch(`${API_URL}/api/reports/non-compliance${query ? `?${query}` : ''}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Unable to load non-compliance report')
      setDepartmentNonCompliance(data)
    } catch (reportError) {
      setDepartmentNonComplianceError(reportError.message || 'Unable to load non-compliance report')
    } finally {
      setDepartmentNonComplianceLoading(false)
    }
  }

  const startViolationEdit = (violation) => {
    setEditingViolation(violation)
    setViolationEditError('')
    setViolationEditForm({
      description: violation.description || '',
      reason: ''
    })
  }

  const loadReviewedStudentHistory = async (student, page = 1, append = false) => {
    setReviewedStudent(student)
    if (!append) {
      setReviewedStudentViolations([])
      setReviewedStudentSummary(null)
    }
    setReviewedStudentLoading(true)
    setReviewedStudentError('')
    try {
      const response = await fetch(`${API_URL}/api/violations/student/${student.id}?page=${page}&limit=25`, {headers:{Authorization:`Bearer ${token}`}})
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.success === false) throw new Error(data?.message || 'Unable to load student violation history.')
      setReviewedStudentViolations((current) => append ? [...current, ...(data.violations || [])] : (data.violations || []))
      setReviewedStudentPage(page)
      setReviewedStudentHasMore(Boolean(data.pagination?.hasMore))
      setReviewedStudentSummary(data.summary || null)
    } catch (error) {
      setReviewedStudentError(error.message)
      if (!append) setReviewedStudentViolations([])
    } finally {
      setReviewedStudentLoading(false)
    }
  }

  const handleViolationUpdate = async (event) => {
    event.preventDefault()
    setViolationEditError('')
    const payload = buildViolationUpdatePayload(violationEditForm)
    if (!payload.description || !payload.reason) return setViolationEditError('Updated details and an audit reason are required.')
    try {
      const response = await fetch(`${API_URL}/api/violations/${editingViolation.id}`, {
        method: 'PUT',
        headers: {'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body: JSON.stringify(payload)
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.success === false) throw new Error(data?.message || 'Unable to update violation.')
      setViolations((current) => current.map((item) => item.id === editingViolation.id ? data.violation : item))
      setEditingViolation(null)
    } catch (error) {
      setViolationEditError(error.message)
    }
  }

  /*
   * ============================================================
   * LOGIN FORM
   * ============================================================
   */

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value
    }))
  }

  /*
   * ============================================================
   * STUDENT FORM
   * ============================================================
   */

  const handleStudentFieldChange = (event) => {
    const { name, value } = event.target

    setStudentForm((current) => ({
      ...current,
      [name]:
        name === 'year_level'
          ? Number(value) || ''
          : value
    }))
  }

  /*
   * ============================================================
   * VIOLATION FORM
   * ============================================================
   */

  const handleViolationFieldChange = (event) => {
    const { name, value } = event.target

    if (name === 'student_search') {
      setViolationForm((current) => ({
        ...current,
        student_search: value,
        student_id: studentIdFromSearch(students, value)
      }))
      return
    }

    setViolationForm((current) => ({
      ...current,
      ...(name === 'violation_type_id' ? { exact_offense: '' } : {}),
      [name]: ['student_id', 'violation_type_id'].includes(name)
        ? Number(value) || ''
        : value
    }))
  }

  /*
   * ============================================================
   * COMMUNITY SERVICE FORM
   * ============================================================
   */

  const handleCommunityServiceFieldChange = (event) => {
    const { name, value } = event.target

    if (name === 'student_search') {
      setCommunityServiceForm((current) => ({
        ...current,
        student_search: value,
        student_id: resolveCommunityServiceStudent(students, value),
        violation_id: ''
      }))
      return
    }

    if (name === 'department_id') {
      setCommunityServiceForm((current) => ({ ...current, department_id: Number(value) || '', department_head_id: '' }))
      return
    }

    setCommunityServiceForm((current) => ({
      ...current,
      [name]:
        [
          'violation_id',
          'student_id',
          'required_hours',
          'department_head_id'
        ].includes(name)
          ? Number(value) || ''
          : value
    }))
  }

  /*
   * ============================================================
   * ADD STUDENT
   * ============================================================
   */

  const handleStudentSubmit = async (event) => {
    event.preventDefault()

    setStudentFormError('')
    setStudentFormSuccess('')

    try {
      const payload = {
        ...studentForm,

        student_number:
          studentForm.student_number.trim(),

        first_name:
          studentForm.first_name.trim(),

        middle_name:
          studentForm.middle_name.trim(),

        last_name:
          studentForm.last_name.trim(),

        email:
          studentForm.email.trim(),

        phone_number:
          studentForm.phone_number.trim(),

        program:
          studentForm.program.trim(),

        section:
          studentForm.section.trim(),

        qr_code:
          studentForm.qr_code.trim() ||
          `STI-${Date.now()}`
      }

      if (
        !payload.student_number ||
        !payload.first_name ||
        !payload.last_name
      ) {
        throw new Error(
          'Student number, first name, and last name are required.'
        )
      }

      const response =
        await fetch(
          `${API_URL}/api/students`,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },

            body: JSON.stringify(payload)
          }
        )

      const data =
        await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          'Unable to save student.'
        )
      }

      setStudentFormSuccess(
        `Student ${payload.first_name} ${payload.last_name} was added.`
      )

      setStudentForm({
        student_number: '',
        first_name: '',
        last_name: '',
        middle_name: '',
        suffix: '',
        email: '',
        phone_number: '',
        program: '',
        section: '',
        year_level: 1,
        qr_code: '',
        profile_image: ''
      })

      const refreshedStudents =
        await fetch(
          `${API_URL}/api/students`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        )

      if (refreshedStudents.ok) {
        const refreshedData =
          await refreshedStudents.json()

        setStudents(
          refreshedData.students || []
        )
      }
      setIsStudentFormOpen(false)
    } catch (studentError) {
      setStudentFormError(
        studentError.message
      )
    }
  }

  /*
   * ============================================================
   * ADD VIOLATION
   * ============================================================
   */

  const handleViolationSubmit = async (event) => {
    event.preventDefault()

    setViolationFormError('')
    setViolationFormSuccess('')

    try {
      const payload = buildViolationPayload(violationForm)

      if (
        !payload.student_id ||
          !payload.violation_type_id ||
          !payload.incident_date ||
          !violationForm.incident_time ||
          !violationForm.exact_offense.trim() ||
        !violationForm.incident_details.trim()
      ) {
        throw new Error(
          'Student, classification, exact offense, incident date and time, and incident details are required.'
        )
      }

      const response =
        await fetch(
          `${API_URL}/api/violations?limit=100`,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },

            body: JSON.stringify(payload)
          }
        )

      const data =
        await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          'Unable to save violation.'
        )
      }

      setViolationFormSuccess(
        `Violation record #${data.violation.id} was added.`
      )

      setViolationForm({
        student_id: '',
        student_search: '',
        violation_type_id: '',
        incident_date: '',
        incident_time: '',
        exact_offense: '',
        incident_details: ''
      })

      const refreshedViolations =
        await fetch(
          `${API_URL}/api/violations`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        )

      if (refreshedViolations.ok) {
        const refreshedData =
          await refreshedViolations.json()

        setViolations(
          refreshedData.violations || []
        )
      }
      setIsViolationFormOpen(false)
    } catch (violationError) {
      setViolationFormError(
        violationError.message
      )
    }
  }

  /*
   * ============================================================
   * COMMUNITY SERVICE
   * ============================================================
   */

  const handleCommunityServiceSubmit =
    async (event) => {
      event.preventDefault()

      setCommunityServiceFormError('')
      setCommunityServiceFormSuccess('')

      try {
        const payload = buildCommunityServiceAssignmentPayload(communityServiceForm)

        if (
          !payload.violation_id ||
          !payload.student_id ||
          !payload.required_hours ||
          !payload.department_id ||
          !payload.department_head_id
        ) {
          throw new Error(
            'Select a student and violation, then enter the required hours.'
          )
        }

        const response =
          await fetch(
            `${API_URL}/api/community-service`,
            {
              method: 'POST',

              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },

              body: JSON.stringify(payload)
            }
          )

        const data =
          await response.json()

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
            'Unable to save community service assignment.'
          )
        }

        setCommunityServiceFormSuccess(
          `Community service was assigned successfully.`
        )

        setCommunityServiceForm({
          violation_id: '',
          student_id: '',
          student_search: '',
          required_hours: '',
          required_minutes: '',
          department_id: '',
          department_head_id: ''
        })

        const refreshedAssignments =
          await fetch(
            `${API_URL}/api/community-service`,
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          )

        if (refreshedAssignments.ok) {
          const refreshedData =
            await refreshedAssignments.json()

          setCommunityServiceAssignments(
            refreshedData.assignments || []
          )
        }
        setIsCommunityServiceFormOpen(false)
      } catch (assignmentError) {
        setCommunityServiceFormError(
          assignmentError.message
        )
      }
    }

  /*
   * ============================================================
   * QR SCANNER
   * ============================================================
   */

  const startQrScanner = async (facingMode = qrFacingMode, restart = false) => {
    setQrError('')
    setQrResult(null)

    try {
      const unavailable = cameraUnavailableMessage({
        secureContext: window.isSecureContext,
        hasMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia)
      })
      if (unavailable) throw new Error(unavailable)

      if (qrScanner && !restart) {
        return
      }

      // Camera scanning is a specialist workflow, so keep its sizeable decoder
      // out of the initial portal bundle and load it only when the user starts it.
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')

      setQrScanner(scanner)
      setIsQrScanning(true)

      await scanner.start(
        { facingMode },

        {
          fps: 15,

          qrbox: scannerQrBox,

          aspectRatio: 1.0
        },

        (decodedText) => {
          if (qrDecodeBusyRef.current) return
          qrDecodeBusyRef.current = true
          setQrForm((current) => ({
            ...current,
            qr_code: decodedText.trim()
          }))

          setVerifiedQr('')
          setQrResult(null)
          setQrError('QR detected. Verify the student before recording attendance.')

          stopQrScanner(scanner).finally(() => { qrDecodeBusyRef.current = false })
        },

        () => {
          /*
           * html5-qrcode continuously reports
           * scan failures while looking for a QR code.
           * Ignore these.
           */
        }
      )
    } catch (error) {
      console.error(
        'QR scanner error:',
        error
      )

      setQrError(
        error.message ||
        'Unable to access the camera. Please allow camera permission.'
      )

      setIsQrScanning(false)
      setQrScanner(null)
    }
  }

  const stopQrScanner = async (
    scanner = qrScanner
  ) => {
    if (!scanner) {
      setIsQrScanning(false)
      setQrScanner(null)
      return
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop()
      }
    } catch (error) {
      console.error(
        'Failed to stop QR scanner:',
        error
      )
    }

    try {
      scanner.clear()
    } catch (error) {
      console.error(
        'Failed to clear QR scanner:',
        error
      )
    }

    setIsQrScanning(false)
    setQrScanner(null)
  }

  const switchQrCamera = async () => {
    const nextFacingMode = qrFacingMode === 'environment' ? 'user' : 'environment'
    await stopQrScanner()
    setQrFacingMode(nextFacingMode)
    await startQrScanner(nextFacingMode, true)
  }

  /*
   * Stop QR scanner when leaving the QR page or unmounting.
   */

  useEffect(() => {
    return () => {
      if (qrScanner) {
        try {
          if (qrScanner.isScanning) {
            qrScanner.stop()
          }
        } catch (error) {
          console.error(
            'Failed to cleanup QR scanner:',
            error
          )
        }

        try {
          qrScanner.clear()
        } catch (error) {
          console.error(
            'Failed to cleanup QR scanner:',
            error
          )
        }
      }
    }
  }, [qrScanner])

  const handleQrFieldChange = (event) => {
    const { name, value } = event.target

    setQrForm((current) => ({
      ...current,

      [name]:
        ['department_id', 'supervising_officer_id'].includes(name)
          ? Number(value) || ''
          : value
    }))

    if (name === 'qr_code' || name === 'department_id') {
      setVerifiedQr('')
      setQrResult(null)
      setQrError('')
      setQrForm((current) => ({ ...current, supervising_officer_id: '' }))
    }
  }

  const handleQrAction = async (action) => {
    if (qrActionBusyRef.current) return
    qrActionBusyRef.current = true
    setQrError('')
    setQrSubmitting(true)

    try {
      if (!qrForm.qr_code.trim()) {
        throw new Error('QR code is required.')
      }

      if (action !== 'scan' && qrForm.qr_code.trim() !== verifiedQr) {
        throw new Error('Verify the student before recording attendance.')
      }

      if (!isDepartmentHead && !qrForm.department_id) {
        throw new Error('Select the department responsible for this attendance record.')
      }

      if (action === 'time-out' && !qrForm.condition) {
        throw new Error('Select the student service condition before Time Out.')
      }
      if (action !== 'scan' && !qrForm.supervising_officer_id) {
        throw new Error('Select the authorized officer supervising this session.')
      }


      const response = await fetch(`${API_URL}/api/qr/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          qr_code: qrForm.qr_code.trim(),
          ...(isDepartmentHead ? {} : {
            department_id: Number(qrForm.department_id)
          }),
          notes: qrForm.notes.trim(),
          ...(action === 'scan' ? {} : { supervising_officer_id: Number(qrForm.supervising_officer_id) }),
          ...(action === 'time-out' ? { condition: qrForm.condition } : {})
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          `Unable to ${action.replace('-', ' ')}.`
        )
      }

      setQrResult({
        action,
        message: data.message,
        student: data.student || null,
        studentId: data.studentId || null,
        notes: data.notes || null,
        assignment: data.assignment || qrResult?.assignment || null,
        session: data.session || null,
        supervising_officer: data.supervising_officer || null,
        available_officers: data.available_officers || qrResult?.available_officers || []
      })
      if (action === 'scan') {
        const officers = data.available_officers || []
        setQrForm((current) => ({ ...current, supervising_officer_id: officers.length === 1 ? Number(officers[0].officer_user_id) : '' }))
      }
      setVerifiedQr(qrForm.qr_code.trim())
      if (action !== 'scan') {
        setRecentQrScans((current) => [{
          key: `${Date.now()}-${action}`,
          studentName: `${data.student?.first_name||''} ${data.student?.last_name||''}`.trim(),
          studentNumber: data.student?.student_number||'',
          action: action === 'time-in' ? 'Time In' : 'Time Out',
          time: data.session?.time_out||data.session?.time_in||new Date().toISOString(),
          department: data.assignment?.department_name||serviceDepartmentOptions(communityServiceDestinations).find((item)=>Number(item.id)===Number(qrForm.department_id))?.name||'Assigned department'
        },...current].slice(0,5))
        const refreshed=await fetch(`${API_URL}/api/qr/scan`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({qr_code:qrForm.qr_code.trim(),...(isDepartmentHead?{}:{department_id:Number(qrForm.department_id)}),notes:''})})
        const refreshedData=await refreshed.json().catch(()=>({}))
        if(refreshed.ok&&refreshedData.success){setQrResult((current)=>({...current,student:refreshedData.student,assignment:refreshedData.assignment,available_officers:refreshedData.available_officers||[]}));const officers=refreshedData.available_officers||[];setQrForm((current)=>({...current,supervising_officer_id:officers.length===1?Number(officers[0].officer_user_id):current.supervising_officer_id}))}
      }
    } catch (qrErrorObject) {
      setQrError(qrErrorObject.message)
    } finally {
      setQrSubmitting(false)
      qrActionBusyRef.current = false
    }
  }

  /*
   * ============================================================
   * LOGIN
   * ============================================================
   */

  const handleSubmit = async (event) => {
    event.preventDefault()

    setIsSubmitting(true)
    setError('')

    try {
      /*
       * Prevent submitting blank credentials.
       */

      if (!form.username.trim()) {
        throw new Error(
          'Please enter your username.'
        )
      }

      if (!form.password) {
        throw new Error(
          'Please enter your password.'
        )
      }

      const data = await login({
        username: form.username.trim(),
        password: form.password
      })

      /*
       * Store ONLY the authentication session.
       * Username/password are NOT stored.
       */

      acceptSession(data)
    } catch (loginError) {
      setError(
        loginError.message
      )

      clearSession()

      setToken('')
      setUser(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const acceptSession = (data) => {
    saveSession(data)
    setToken(data.token)
    setUser(data.user)
    setError('')
    setForm({ username: '', password: '' })
    navigateTo(data.user.password_change_required ? '/account/password-change' : getHomePath(data.user.role), { replace: true })
  }

  /*
   * ============================================================
   * LOGOUT
   * ============================================================
   */

  const handleLogout = () => {
    clearSession()

    setToken('')
    setUser(null)
    setError('')

    /*
     * Clear login fields after logout.
     */

    setForm({
      username: '',
      password: ''
    })

    setStudents([])
    setViolations([])
    setCommunityServiceAssignments([])
    setClearanceRecords([])

    setActiveView('Dashboard')
    navigateTo('/login', { replace: true })
  }

  /*
   * ============================================================
   * REPORTS
   * ============================================================
   */

  const fetchReport = async () => {
    if (reportLoading) return
    if (reportFilters.from_date && reportFilters.to_date && reportFilters.from_date > reportFilters.to_date) {
      setReportError('Choose an end date on or after the start date.')
      return
    }
    setReportGenerated(false)
    setReportPage(1)
    setReportLoading(true)
    setReportError('')

    try {
      const params = buildAdminReportQuery(reportType, reportFilters)

      const response =
        await fetch(
          `${API_URL}/api/reports/${reportType}${params ? `?${params}` : ''}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        )

      const data =
        await response.json()

      if (
        response.ok &&
        data.success
      ) {
        setReportData(
          data.data || []
        )
        setReportGenerated(true)
      } else {
        setReportData([])
        setReportError(data.message || 'Unable to generate this report.')
      }
    } catch (error) {
      console.error(
        'Report fetch error:',
        error
      )

      setReportData([])
      setReportError(error.message || 'Unable to generate this report.')
    } finally {
      setReportLoading(false)
    }
  }

  const handleReportFilterChange = (
    event
  ) => {
    const {
      name,
      value
    } = event.target

    setReportFilters((current) => ({
      ...current,
      [name]: value
    }))
  }

  const exportReportCSV = async () => {
    if (reportType !== 'violations' && reportData.length === 0) {
      return
    }

    if (reportType === 'violations') {
      setReportError('')
      try {
        const params = buildAdminReportQuery(reportType, reportFilters)
        const response = await fetch(`${API_URL}/api/reports/violations.csv${params ? `?${params}` : ''}`, { headers:{ Authorization:`Bearer ${token}` } })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.message || 'Unable to export this report.')
        }
        const blob = await response.blob()
        const disposition = response.headers.get('content-disposition') || ''
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `violations-report-${new Date().toISOString().slice(0,10)}.csv`
        const url = window.URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = filename
        anchor.click()
        window.URL.revokeObjectURL(url)
      } catch (error) { setReportError(error.message) }
      return
    }

    const csvContent = createDepartmentReportCsv(presentedReportRows(reportData))

    const blob =
      new Blob(
        [csvContent],
        {
          type: 'text/csv'
        }
      )

    const url =
      window.URL.createObjectURL(
        blob
      )

    const a =
      document.createElement('a')

    a.href = url

    a.download =
      `${reportType}-report-${new Date().toISOString().slice(0, 10)}.csv`

    a.click()

    window.URL.revokeObjectURL(
      url
    )
  }

  /*
   * ============================================================
   * RENDER CONTENT
   * ============================================================
   */

  const renderContent = () => {
    /*
     * ==========================================================
     * LOGIN SCREEN
     * ==========================================================
     */

    if (routePath === '/privacy' || routePath === '/terms') {
      return <PublicPolicyPage type={routePath.slice(1)} onNavigate={navigateTo} />
    }

    if (!isLoggedIn && routeResolution.status === 'not_found') {
      return <RouteStatePage type="not_found" onGoHome={() => navigateTo('/login')} actionLabel="Return to sign in" />
    }

    if (!isLoggedIn) {
      return (
        <LoginPage
          form={form}
          error={error}
          isSubmitting={isSubmitting}
          googleClientId={GOOGLE_CLIENT_ID}
          onChange={handleChange}
          onGoogleSession={acceptSession}
          onSubmit={handleSubmit}
          routePath={routePath}
          onNavigate={navigateTo}
        />
      )
    }

    if (userRole === 'SYSTEM_ADMIN' && activeView === 'System Dashboard') {
      return <SystemDashboard token={token} />
    }

    if (userRole === 'SYSTEM_ADMIN' && activeView === 'Account Settings') {
      return <AccountSecuritySettings token={token} user={user} onSession={acceptSession} />
    }

    if (activeView === 'Support Access' && ['SYSTEM_ADMIN','DISCIPLINE_ADMIN'].includes(userRole)) {
      return <SupportAccessPanel token={token} role={userRole} />
    }

    if (activeView === 'Messages') {
      return <MessagesPage token={token} role={userRole} students={students} onUnreadChange={updateUnreadMessages} realtimeSocket={realtimeSocket} />
    }

    if (user?.password_change_required) {
      return <PasswordChangeRequired token={token} onSession={acceptSession} onLogout={handleLogout} />
    }

    if (routeResolution.status === 'unauthorized') {
      return <RouteStatePage type="unauthorized" onGoHome={() => navigateTo(getHomePath(userRole))} />
    }

    if (routeResolution.status === 'not_found') {
      return <RouteStatePage type="not_found" onGoHome={() => navigateTo(getHomePath(userRole))} />
    }

    /*
     * ==========================================================
     * STUDENT VIEW
     * ==========================================================
     */

    if (isStudent) {
      if (activeView === 'My Service') {
        return (
          <StudentCommunityService
            dtr={studentDtr}
            loading={dashboardLoading || studentDtrLoading}
            error={studentDtrError || dashboardError}
            onFilter={loadStudentDtr}
          />
        )
      }

      if (activeView === 'My QR') {
        return (
          <StudentQr
            profile={studentProfile}
            loading={dashboardLoading}
            error={dashboardError}
          />
        )
      }

      /*
       * --------------------------------------------------------
       * MY PROFILE
       * --------------------------------------------------------
       */

      if (
        activeView === 'My Profile'
      ) {
        return (
          <StudentProfile
            profile={studentProfile}
            username={user.username}
            loading={dashboardLoading}
            error={dashboardError}
          />
        )
      }

      /*
       * --------------------------------------------------------
       * MY VIOLATIONS
       * --------------------------------------------------------
       */

      if (
        activeView === 'My Violations'
      ) {
        return (
          <StudentViolations
            violations={violations}
            loading={dashboardLoading}
            error={dashboardError}
          />
        )
      }

      /*
       * --------------------------------------------------------
       * MY CLEARANCE
       * --------------------------------------------------------
       */

      if (activeView === 'My Clearance') {
        return (
          <StudentClearance
            eligibility={clearanceEligibility}
            records={clearanceRecords}
            loading={dashboardLoading}
            error={clearanceCertificateError || dashboardError}
            certificate={clearanceCertificate}
            onLoadCertificate={loadClearanceCertificate}
            token={token}
          />
        )
      }

      if (activeView === 'Notifications') {
        return <StudentNotifications notifications={studentNotifications} loading={dashboardLoading} error={notificationActionError || dashboardError} onMarkRead={markNotificationRead} onAcknowledge={acknowledgeNotification} onMarkAll={markAllNotificationsRead} onNavigate={navigateTo} audience="STUDENT" />
      }

      if (activeView === 'Legacy Clearance') {
        return (
          <section className="table-card">
            <div className="table-header">
              <h3>
                My Clearance
              </h3>

              <span>
                {clearanceRecords.length}{' '}
                records
              </span>
            </div>

            {clearanceRecords.length === 0 ? (
              <p className="empty-state">
                No clearance records found.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="management-record-table">
                  <thead>
                    <tr>
                      <th>
                        Academic Year
                      </th>

                      <th>
                        Semester
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Active Violation
                      </th>

                      <th>
                        Pending Service
                      </th>

                      <th>
                        Cleared By
                      </th>

                      <th>
                        Cleared At
                      </th>

                      <th>
                        Remarks
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {clearanceRecords.map(
                      (record) => (
                        <tr
                          key={
                            record.id
                          }
                        >
                          <td data-label="Student">
                            {
                              record.academic_year
                            }
                          </td>

                          <td data-label="Program">
                            {
                              record.semester
                            }
                          </td>

                          <td data-label="Section">
                            <span className="status-badge">
                              {
                                record.status
                              }
                            </span>
                          </td>

                          <td data-label="Year">
                            {
                              record.has_active_violation
                                ? 'Yes'
                                : 'No'
                            }
                          </td>

                          <td>
                            {
                              record.has_pending_service
                                ? 'Yes'
                                : 'No'
                            }
                          </td>

                          <td>
                            {
                              record.cleared_by
                                ? `User #${record.cleared_by}`
                                : '—'
                            }
                          </td>

                          <td>
                            {
                              record.cleared_at
                                ? formatManilaDateTime(record.cleared_at)
                                : '—'
                            }
                          </td>

                          <td>
                            {
                              record.remarks ||
                              '—'
                            }
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      }

      /*
       * --------------------------------------------------------
       * STUDENT DASHBOARD
       * --------------------------------------------------------
       */

      return (
        <StudentDashboard
          profile={studentProfile}
          violations={violations}
          assignments={communityServiceAssignments}
          clearanceRecords={clearanceRecords}
          eligibility={clearanceEligibility}
          loading={dashboardLoading}
          error={dashboardError}
          onNavigate={navigateTo}
        />
      )
    }

    /*
     * ==========================================================
     * DEPARTMENT HEAD VIEW
     * ==========================================================
     */

    if (
      isDepartmentHead &&
      activeView === 'Dashboard'
    ) {
      return (
        <DepartmentDashboard
          report={departmentDtr}
          loading={dashboardLoading}
          error={dashboardError}
          onOpenScanner={() => navigateTo('/department/qr-scan')}
          onNavigate={navigateTo}
        />
      )
    }

    if (isDepartmentHead && activeView === 'DTR') {
      return (
        <DepartmentDtr
          report={departmentDtr}
          loading={dashboardLoading || departmentDtrLoading}
          error={departmentDtrError || dashboardError}
          onFilter={loadDepartmentDtr}
        />
      )
    }

    if (isDepartmentHead && activeView === 'Students') {
      return (
        <DepartmentStudents
          report={departmentDtr}
          loading={dashboardLoading}
          error={dashboardError}
          onOpenDtr={() => navigateTo('/department/dtr')}
          token={token}
        />
      )
    }

    if (isDepartmentHead && activeView === 'Community Service') {
      return (
        <DepartmentCommunityService
          assignments={communityServiceAssignments}
          loading={dashboardLoading}
          error={dashboardError}
          onOpenScanner={() => navigateTo('/department/qr-scan')}
          token={token}
          onAttendanceUpdated={() => setDashboardRefreshKey((current) => current + 1)}
          realtimeSocket={realtimeSocket}
        />
      )
    }

    if (isDepartmentHead && activeView === 'Non-Compliance') {
      return <DepartmentNonCompliance report={departmentNonCompliance} loading={dashboardLoading || departmentNonComplianceLoading} error={departmentNonComplianceError || dashboardError} sortBy={departmentNonComplianceSort} onSort={loadDepartmentNonCompliance} />
    }

    if (isDepartmentHead && activeView === 'Reports') {
      return <DepartmentReports dtr={departmentDtr} nonCompliance={departmentNonCompliance} loading={dashboardLoading} error={dashboardError} />
    }

    if (activeView === 'Notifications') {
      return <StudentNotifications notifications={studentNotifications} loading={dashboardLoading} error={notificationActionError || dashboardError} onMarkRead={markNotificationRead} onAcknowledge={acknowledgeNotification} onMarkAll={markAllNotificationsRead} onNavigate={navigateTo} audience={isStudent ? 'STUDENT' : 'STAFF'} />
    }

    if (activeView === 'Dashboard') {
      return <AdminDashboard students={students} violations={violations} assignments={communityServiceAssignments} activeSessions={activeServiceSessions} pendingRegistrations={pendingAccountCounts.students} unreadMessages={unreadMessages} loading={dashboardLoading} role={userRole} onNavigate={navigateTo} />
    }

    /*
     * ==========================================================
     * ACCESS CHECK
     * ==========================================================
     */

    if (
      !isAdmin &&
      !isDepartmentHead
    ) {
      return (
        <p
          style={{
            color: '#b42318'
          }}
        >
          Access denied. Please contact
          system administrator.
        </p>
      )
    }

    if (isAdmin && activeView === 'Registrations') {
      return <AdminRegistrationReviewWorkspace token={token} role={userRole} onPendingCountChange={updatePendingStudentCount} />
    }

    if (userRole === 'DISCIPLINE_ADMIN' && activeView === 'Departments & Officer Accounts') {
      return <AdminDepartmentOfficers token={token} />
    }

    if (activeView === 'Account Settings' && userRole !== 'DISCIPLINE_ADMIN') {
      return <AccountSecuritySettings token={token} user={user} onSession={acceptSession} />
    }

    if (userRole === 'DISCIPLINE_ADMIN' && activeView === 'Account Settings') {
      return <AdminAccountSettings token={token} onSession={acceptSession} />
    }

    if (userRole === 'DISCIPLINE_ADMIN' && activeView === 'Audit Log') {
      return <AdminAuditLog token={token} />
    }

    /*
     * ==========================================================
     * STUDENTS
     * ==========================================================
     */

    if (
      activeView === 'Students'
    ) {
      const visibleStudents = filterAdminStudents(students, studentRosterSearch)
      const reviewedCondition = reviewedStudent ? summarizeStudentCondition(reviewedStudent.id, reviewedStudentViolations) : null
      const sanctionGuidance = handbookSanctionGuidance(reviewedStudentSummary?.categoryCounts || [])
      const studentsWithViolations = new Set(violations.map((item) => Number(item.student_id))).size
      const studentsInService = new Set(communityServiceAssignments.filter((item) => !['COMPLETED', 'CLEARED'].includes(String(item.status).toUpperCase())).map((item) => Number(item.student_id))).size
      const clearedStudents = students.filter((student) => summarizeStudentCondition(student.id, violations).open === 0).length
      return (
        <>
          <header className="management-page-header">
            <div><span className="page-breadcrumb">Home / Students</span><h2>Students Management</h2><p>View and manage student records, violations, community service, and clearance status.</p></div>
            <button type="button" className="primary-action" onClick={() => { setStudentFormError(''); setStudentFormSuccess(''); setIsStudentFormOpen(true) }}>＋ Add Student</button>
          </header>
          <section className="management-metrics" aria-label="Student summary">
            <article className="management-metric metric-blue"><i>◎</i><div><strong>{students.length}</strong><span>Total Students</span></div></article>
            <article className="management-metric metric-red"><i>△</i><div><strong>{studentsWithViolations}</strong><span>With Violations</span></div></article>
            <article className="management-metric metric-orange"><i>◷</i><div><strong>{studentsInService}</strong><span>Ongoing Community Service</span></div></article>
            <article className="management-metric metric-green"><i>✓</i><div><strong>{clearedStudents}</strong><span>No Open Violations</span></div></article>
          </section>
          {isStudentFormOpen && <Modal title="Add Student" drawer onClose={() => setIsStudentFormOpen(false)}><div className="drawer-intro"><strong>Create a student record</strong><span>Use the student's official school information.</span></div>
          <section className="drawer-form-card">
            <div className="table-header">
              <h3>
                Add student
              </h3>

              <span>
                New record
              </span>
            </div>

            <form
              className="student-form"
              onSubmit={
                handleStudentSubmit
              }
            >
              <div className="student-form-grid">
                <label>
                  Student Number

                  <input
                    type="text"
                    name="student_number"
                    value={
                      studentForm.student_number
                    }
                    onChange={
                      handleStudentFieldChange
                    }
                    placeholder="School-issued Student Number"
                  />
                </label>

                <label>
                  First Name

                  <input
                    type="text"
                    name="first_name"
                    value={
                      studentForm.first_name
                    }
                    onChange={
                      handleStudentFieldChange
                    }
                    placeholder="Juan"
                  />
                </label>

                <label>
                  Last Name

                  <input
                    type="text"
                    name="last_name"
                    value={
                      studentForm.last_name
                    }
                    onChange={
                      handleStudentFieldChange
                    }
                    placeholder="Dela Cruz"
                  />
                </label>

                <label>
                  Middle Name

                  <input
                    type="text"
                    name="middle_name"
                    value={
                      studentForm.middle_name
                    }
                    onChange={
                      handleStudentFieldChange
                    }
                    placeholder="Optional"
                  />
                </label>

                <label>
                  Suffix

                  <input
                    type="text"
                    name="suffix"
                    value={
                      studentForm.suffix
                    }
                    onChange={
                      handleStudentFieldChange
                    }
                    placeholder="Optional"
                  />
                </label>

                <label>
                  Email

                  <input
                    type="email"
                    name="email"
                    value={
                      studentForm.email
                    }
                    onChange={
                      handleStudentFieldChange
                    }
                    placeholder="student@email.com"
                  />
                </label>

                <label>
                  Phone

                  <input
                    type="tel"
                    name="phone_number"
                    value={
                      studentForm.phone_number
                    }
                    onChange={
                      handleStudentFieldChange
                    }
                    placeholder="09XXXXXXXXX"
                  />
                </label>

                <label>
                  Program

                  <input
                    type="text"
                    name="program"
                    value={
                      studentForm.program
                    }
                    onChange={
                      handleStudentFieldChange
                    }
                    placeholder="BSIT"
                  />
                </label>

                <label>
                  Section

                  <input
                    type="text"
                    name="section"
                    value={
                      studentForm.section
                    }
                    onChange={
                      handleStudentFieldChange
                    }
                    placeholder="A103"
                  />
                </label>

                <label>
                  Year Level

                  <input
                    type="number"
                    name="year_level"
                    value={
                      studentForm.year_level
                    }
                    onChange={
                      handleStudentFieldChange
                    }
                    min="1"
                    max="8"
                  />
                </label>

                <label>
                  QR Code

                  <input
                    type="text"
                    name="qr_code"
                    value={
                      studentForm.qr_code
                    }
                    onChange={
                      handleStudentFieldChange
                    }
                    placeholder="Optional auto-generated"
                  />
                </label>
              </div>

              {studentFormError && (
                <p className="error-message">
                  {studentFormError}
                </p>
              )}

              {studentFormSuccess && (
                <p className="success-message">
                  {studentFormSuccess}
                </p>
              )}

              <button
                type="submit"
                className="submit-btn"
              >
                Save Student
              </button>
            </form>
          </section></Modal>}

          <section className="table-card">
            <div className="table-header management-table-header">
              <div><h3>Student Directory</h3><p>Search and review the records available to your account.</p></div>
              <span>
                {dashboardLoading
                  ? 'Loading...'
                  : `${students.length} records`}
              </span>
            </div>

            <div className="noncompliance-toolbar">
              <label><span>Search students</span><input type="search" value={studentRosterSearch} onChange={(event)=>setStudentRosterSearch(event.target.value)} placeholder="Student number, name, program, or section"/></label>
            </div>
            <div className="offense-legend" aria-label="Offense indicator legend">
              <span>Indicator:</span><OffenseIndicator level="MINOR_1" label="1 minor"/><OffenseIndicator level="MINOR_2" label="2 minors"/><OffenseIndicator level="MAJOR_LEVEL" label="Major-level"/><OffenseIndicator level="GRAVE" label="Grave"/>
            </div>

            {visibleStudents.length === 0 &&
            !dashboardLoading ? (
              <p className="empty-state">
                No students match this search.
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Student
                      </th>

                      <th>
                        Program
                      </th>

                      <th>
                        Section
                      </th>

                      <th>
                        Year
                      </th>
                      <th>Violations</th>
                      <th>Community Service</th>
                      <th>Clearance</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleStudents.map(
                      (student) => {
                        const condition = summarizeStudentCondition(student.id, violations)
                        const assignment = communityServiceAssignments.find((item) => Number(item.student_id) === Number(student.id))
                        const required = Number(assignment?.required_hours || 0)
                        const remaining = Number(assignment?.remaining_hours ?? required)
                        const completed = Math.max(0, required - remaining)
                        const progress = required > 0 ? Math.min(100, Math.round((completed / required) * 100)) : 0
                        return (
                        <tr
                          key={
                            student.id
                          }
                        >
                          <td>
                            <div className="student-cell">
                              <OffenseIndicator level={student.offense_indicator_level} compact />
                              <span><strong>{student.first_name} {student.last_name}</strong><small>{student.student_number}</small></span>
                            </div>
                          </td>

                          <td>
                            {
                              student.program ||
                              '—'
                            }
                          </td>

                          <td>
                            {
                              student.section ||
                              '—'
                            }
                          </td>

                          <td>
                            {
                              student.year_level ||
                              '—'
                            }
                          </td>
                          <td data-label="Violations">{condition.total} total / {condition.open} open</td>
                          <td data-label="Service progress">{assignment ? <div className="table-progress"><div><span style={{width:`${progress}%`}} /></div><small>{formatDuration(completed)} / {formatDuration(required)}</small></div> : '—'}</td>
                          <td data-label="Clearance"><span className={`status-badge ${condition.open === 0 ? 'status-cleared' : 'status-pending'}`}>{condition.open === 0 ? 'Eligible' : 'Not cleared'}</span></td>
                          <td data-label="Actions"><div className="table-actions"><button type="button" className="primary-row-action" onClick={()=>loadReviewedStudentHistory(student)}>View Student</button><button type="button" className="secondary-button guardian-contact-button" onClick={()=>setGuardianContactStudent(student)} aria-label={`Guardian Contact for ${student.first_name} ${student.last_name}`}><PortalIcon name="phone"/><span>Guardian Contact</span></button><StudentAccountActions token={token} student={student} onUpdated={(updated)=>setStudents(current=>current.map(item=>Number(item.id)===Number(updated.id)?updated:item))}/></div></td>
                        </tr>
                        )
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {guardianContactStudent && <Modal title="Guardian Contact" drawer onClose={() => setGuardianContactStudent(null)}><GuardianContactPanel token={token} student={guardianContactStudent} onClose={() => setGuardianContactStudent(null)} showClose={false} /></Modal>}

          {reviewedStudent && reviewedCondition && (
            <Modal title={`Student record — ${reviewedStudent.student_number}`} drawer onClose={()=>setReviewedStudent(null)}>
            <section className="table-card modal-content-card">
              <div className="table-header"><div><h3>{reviewedStudent.first_name} {reviewedStudent.last_name}</h3><span>{reviewedStudentSummary?.condition || reviewedCondition.condition}</span></div></div>
              <section className="student-record-overview" aria-label="Student overview"><h4>Student overview</h4><dl>{[['Student number', reviewedStudent.student_number], ['Program', reviewedStudent.program], ['Section', reviewedStudent.section], ['Year level', reviewedStudent.year_level], ['Email', reviewedStudent.email], ['Phone', reviewedStudent.phone_number]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl></section>
              {reviewedStudentSummary?.offenseStatus && <div className="offense-summary"><OffenseIndicator level={reviewedStudentSummary.offenseStatus.indicator_level} label={reviewedStudentSummary.offenseStatus.major_level_review_required ? 'Major-level review required from repeated minor offenses' : undefined} /></div>}
              <section className="stats-grid department-stats" aria-label="Student violation condition"><article className="stat-card"><span>Total violations</span><strong>{reviewedStudentSummary?.total ?? reviewedCondition.total}</strong></article><article className="stat-card"><span>Open violations</span><strong>{reviewedStudentSummary?.open ?? reviewedCondition.open}</strong></article><article className="stat-card"><span>Resolved violations</span><strong>{reviewedStudentSummary?.resolved ?? reviewedCondition.resolved}</strong></article><article className="stat-card"><span>Remaining service</span><strong>{formatDuration(reviewedStudentSummary?.remainingHours ?? reviewedCondition.remainingHours)}</strong></article></section>
              {sanctionGuidance.length>0&&<section className="registration-review-list" aria-label="Handbook sanction guidance"><div className="table-header"><div><h3>Handbook sanction reference</h3><span>Verify the offense sequence and case circumstances before deciding</span></div></div>{sanctionGuidance.map((item)=><article key={item.code}><div className="registration-review-heading"><div><h4>{item.name}</h4><p>{item.count} recorded offense{item.count===1?'':'s'} in this classification</p></div></div><p><strong>Handbook reference:</strong> {item.guidance}</p></article>)}</section>}
              {reviewedStudentError&&<p className="error-message" role="alert">{reviewedStudentError}</p>}
              {reviewedStudentLoading&&reviewedCondition.records.length===0?<p className="empty-state">Loading violation history...</p>:reviewedCondition.records.length===0?<p className="empty-state">No violation history for this student.</p>:<div className="registration-review-list">{reviewedCondition.records.map((violation)=><article key={violation.id}><div className="registration-review-heading"><div><h4>{violation.violation_name || `Violation #${violation.id}`}</h4><p>{formatIncidentDateTime(violation.incident_date, violation.incident_time)} · {violation.severity || 'Severity unavailable'}</p></div><span className="status-badge">{violation.status}</span></div><p>{violation.description || 'No incident details recorded.'}</p><dl><div><dt>Required service</dt><dd>{formatDuration(violation.required_service_hours)}</dd></div><div><dt>Completed service</dt><dd>{formatDuration(violation.completed_service_hours)}</dd></div></dl></article>)}</div>}
              {reviewedStudentHasMore&&<button type="button" className="secondary-button" disabled={reviewedStudentLoading} onClick={()=>loadReviewedStudentHistory(reviewedStudent,reviewedStudentPage+1,true)}>{reviewedStudentLoading?'Loading...':'Load older violations'}</button>}
              <p className="form-guidance">Use the documented category, repeat-offense history, case facts, and handbook procedure when deciding sanctions. The portal does not assign punishment automatically.</p>
            </section>
            </Modal>
          )}
        </>
      )
    }

    /*
     * ==========================================================
     * VIOLATIONS
     * ==========================================================
     */

    if (
      activeView === 'Violations'
    ) {
      const selectedType = selectedViolationType(violationTypes, violationForm.violation_type_id)
      const exactOffenses = offensesForType(selectedType)
      const violationStatusCount = (status) => violations.filter((item) => String(item.status).toUpperCase() === status).length
      const violationSeverityCount = (severity) => violations.filter((item) => String(item.severity).toUpperCase().includes(severity)).length
      const visibleViolations = violations.filter((item) => {
        const query = violationTableFilters.search.trim().toLowerCase()
        const matchesSearch = !query || [item.student_name, item.student_number, item.exact_offense, item.violation_name].filter(Boolean).join(' ').toLowerCase().includes(query)
        const matchesStatus = violationTableFilters.status === 'ALL' || String(item.status).toUpperCase() === violationTableFilters.status
        const matchesSeverity = violationTableFilters.severity === 'ALL' || String(item.severity).toUpperCase().includes(violationTableFilters.severity)
        return matchesSearch && matchesStatus && matchesSeverity
      })
      return (
        <>
          <header className="management-page-header">
            <div><span className="page-breadcrumb">Home / Violations</span><h2>Violations Management</h2><p>Manage student violations, disciplinary progress, and service requirements.</p></div>
            <button type="button" className="primary-action" onClick={() => { setViolationFormError(''); setViolationFormSuccess(''); setIsViolationFormOpen(true) }}>＋ Record Violation</button>
          </header>
          <section className="management-metrics management-metrics--wide" aria-label="Violation summary">
            <article className="management-metric metric-red"><i>△</i><div><strong>{violations.length}</strong><span>Total Violations</span></div></article>
            <article className="management-metric metric-orange"><i>!</i><div><strong>{violationSeverityCount('MINOR')}</strong><span>Minor</span></div></article>
            <article className="management-metric metric-red"><i>!</i><div><strong>{violationSeverityCount('MAJOR')}</strong><span>Major</span></div></article>
            <article className="management-metric metric-purple"><i>!</i><div><strong>{violationSeverityCount('GRAVE')}</strong><span>Grave</span></div></article>
            <article className="management-metric metric-blue"><i>□</i><div><strong>{violationStatusCount('OPEN')}</strong><span>Open</span></div></article>
            <article className="management-metric metric-orange"><i>◷</i><div><strong>{violationStatusCount('PENDING')}</strong><span>Pending</span></div></article>
            <article className="management-metric metric-green"><i>✓</i><div><strong>{violationStatusCount('COMPLETED')}</strong><span>Completed</span></div></article>
            <article className="management-metric metric-green"><i>◇</i><div><strong>{violationStatusCount('CLEARED')}</strong><span>Cleared</span></div></article>
          </section>
          {isViolationFormOpen && <Modal title="Record Violation" drawer onClose={() => setIsViolationFormOpen(false)}><div className="drawer-intro"><strong>Create an incident record</strong><span>Choose the exact handbook classification and document only verified facts.</span></div>
          <section className="drawer-form-card">
            <div className="table-header">
              <h3>
                Add violation
              </h3>

              <span>
                New record
              </span>
            </div>
            <div className="offense-legend" aria-label="Offense indicator legend">
              <span>Indicator:</span><OffenseIndicator level="MINOR_1" label="1 minor"/><OffenseIndicator level="MINOR_2" label="2 minors"/><OffenseIndicator level="MAJOR_LEVEL" label="Major-level"/><OffenseIndicator level="GRAVE" label="Grave"/>
            </div>

            <form
              className="student-form"
              onSubmit={
                handleViolationSubmit
              }
            >
              <div className="student-form-grid">
                <label>
                  Student

                  <input
                    type="search"
                    name="student_search"
                    list="violation-student-options"
                    placeholder="Type a student number or name"
                    value={
                      violationForm.student_search
                    }
                    onChange={
                      handleViolationFieldChange
                    }
                    required
                  />
                  <datalist id="violation-student-options">
                    {students.map((student) => (
                      <option key={student.id} value={studentOptionLabel(student)} />
                    ))}
                  </datalist>
                  <span>Search by student number, first name, or last name, then choose the matching result.</span>
                </label>

                <label>
                  Handbook classification

                  <select
                    name="violation_type_id"
                    value={
                      violationForm.violation_type_id
                    }
                    onChange={
                      handleViolationFieldChange
                    }
                    required
                  >
                    <option value="">Select a classification</option>
                    {violationTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.violation_name} ({type.severity})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Incident Date

                  <input
                    type="date"
                    name="incident_date"
                    value={
                      violationForm.incident_date
                    }
                    onChange={
                      handleViolationFieldChange
                    }
                  />
                </label>

                <label>
                  Incident time
                  <input
                    type="time"
                    name="incident_time"
                    value={violationForm.incident_time}
                    onChange={handleViolationFieldChange}
                    required
                  />
                </label>

                <label className="full-width-field">
                  Specific handbook offense

                  <select
                    name="exact_offense"
                    value={violationForm.exact_offense}
                    onChange={handleViolationFieldChange}
                    disabled={!selectedType || exactOffenses.length === 0}
                    required
                  >
                    <option value="">
                      {selectedType ? 'Select the exact offense' : 'Choose a handbook classification first'}
                    </option>
                    {exactOffenses.map((offense) => (
                      <option key={offense} value={offense}>{offense}</option>
                    ))}
                  </select>
                </label>

                <label className="full-width-field">
                  Incident details

                  <textarea
                    name="incident_details"
                    value={
                      violationForm.incident_details
                    }
                    onChange={
                      handleViolationFieldChange
                    }
                    rows="4"
                    placeholder="Describe what happened, where and when it occurred, and other relevant facts"
                    required
                  />
                </label>
                {selectedType && (
                  <p className="form-guidance full-width-field">
                    {selectedType.description}
                    {' '}Service hours are assigned by authorized staff for this case; the handbook does not prescribe an automatic hour value.
                  </p>
                )}
              </div>

              {violationFormError && (
                <p className="error-message">
                  {violationFormError}
                </p>
              )}

              {violationFormSuccess && (
                <p className="success-message">
                  {violationFormSuccess}
                </p>
              )}

              <button
                type="submit"
                className="submit-btn"
              >
                Save Violation
              </button>
            </form>
          </section></Modal>}

          {editingViolation && (
            <Modal title={`Edit violation #${editingViolation.id}`} drawer onClose={()=>setEditingViolation(null)}><section className="drawer-form-card">
              <div className="table-header"><h3>Edit violation #{editingViolation.id}</h3><span>Open cases only</span></div>
              <form className="student-form" onSubmit={handleViolationUpdate}>
                <div className="student-form-grid">
                  <label className="full-width-field">Violation and incident details<textarea rows="5" value={violationEditForm.description} onChange={(event)=>setViolationEditForm({...violationEditForm,description:event.target.value})} required/></label>
                  <label className="full-width-field">Reason for change<textarea rows="3" value={violationEditForm.reason} onChange={(event)=>setViolationEditForm({...violationEditForm,reason:event.target.value})} placeholder="Explain why this record is being updated" required/></label>
                </div>
                {violationEditError && <p className="error-message" role="alert">{violationEditError}</p>}
                <div className="registration-review-actions"><button type="submit">Save audited changes</button><button type="button" className="secondary-button" onClick={()=>setEditingViolation(null)}>Cancel</button></div>
              </form>
            </section></Modal>
          )}

          <section className="table-card">
            <div className="table-header management-table-header">
              <div><h3>Violation Records</h3><p>Most recent incidents and their current status.</p></div>

              <span>
                {dashboardLoading
                  ? 'Loading...'
                  : `${violations.length} entries`}
              </span>
            </div>
            <div className="directory-toolbar management-filter-bar"><input type="search" aria-label="Search violations" value={violationTableFilters.search} onChange={(event)=>setViolationTableFilters({...violationTableFilters,search:event.target.value})} placeholder="Search student, number, or offense…"/><select aria-label="Filter violation classification" value={violationTableFilters.severity} onChange={(event)=>setViolationTableFilters({...violationTableFilters,severity:event.target.value})}><option value="ALL">All classifications</option><option value="MINOR">Minor</option><option value="MAJOR">Major</option><option value="GRAVE">Grave</option></select><select aria-label="Filter violation status" value={violationTableFilters.status} onChange={(event)=>setViolationTableFilters({...violationTableFilters,status:event.target.value})}><option value="ALL">All statuses</option><option value="OPEN">Open</option><option value="PENDING">Pending</option><option value="COMPLETED">Completed</option><option value="CLEARED">Cleared</option></select></div>

            {visibleViolations.length === 0 &&
            !dashboardLoading ? (
              <p className="empty-state">
                No violations match the selected filters.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="management-record-table">
                  <thead>
                    <tr>
                      <th>
                        ID
                      </th>

                      <th>
                        Student
                      </th>

                      <th>Incident</th>

                      <th>Offense</th>

                      <th>Classification</th>

                      <th>
                        Status
                      </th>

                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleViolations
                      .slice(0, 10)
                      .map(
                        (violation) => (
                          <tr
                            key={
                              violation.id
                            }
                          >
                            <td data-label="Record ID" className="internal-record-id">
                              #{violation.id}
                            </td>

                            <td data-label="Student">
                              <div className="student-cell">
                                <OffenseIndicator level={violation.offense_indicator_level} compact />
                                <span><strong>{violation.student_name || 'Student record'}</strong><small>{violation.student_number || 'Number unavailable'}</small></span>
                              </div>
                            </td>

                            <td data-label="Incident">{formatIncidentDateTime(violation.incident_date, violation.incident_time)}</td>

                            <td data-label="Offense">{violation.exact_offense || violation.violation_name || 'Not recorded'}</td>

                            <td data-label="Classification">{violation.severity || '—'}</td>

                            <td data-label="Status">
                              <span className="status-badge">
                                {
                                  violation.status
                                }
                              </span>
                            </td>

                            <td data-label="Actions"><div className="table-actions"><button type="button" className="primary-row-action" onClick={()=>setViewingViolation(violation)}>View</button>{violation.status === 'OPEN' && <button type="button" className="icon-row-action" aria-label={`Edit violation ${violation.id}`} onClick={()=>startViolationEdit(violation)}>✎</button>}</div></td>
                          </tr>
                        )
                      )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {viewingViolation && <Modal title={`Violation #${viewingViolation.id}`} drawer onClose={()=>setViewingViolation(null)}><div className="record-detail-drawer"><header><div><span className="page-breadcrumb">Incident record</span><h3>{viewingViolation.student_name || viewingViolation.student_number || 'Student record'}</h3><p>{viewingViolation.student_number || 'Student number unavailable'}</p></div><span className="status-badge">{viewingViolation.status}</span></header><dl><div><dt>Offense</dt><dd>{viewingViolation.exact_offense || viewingViolation.violation_name || 'Not recorded'}</dd></div><div><dt>Classification</dt><dd>{viewingViolation.severity || 'Not recorded'}</dd></div><div><dt>Incident</dt><dd>{formatIncidentDateTime(viewingViolation.incident_date, viewingViolation.incident_time)}</dd></div><div><dt>Required service</dt><dd>{formatDuration(viewingViolation.required_service_hours)}</dd></div><div><dt>Completed service</dt><dd>{formatDuration(viewingViolation.completed_service_hours)}</dd></div></dl><section><h4>Incident details</h4><p>{viewingViolation.description || viewingViolation.incident_details || 'No incident details recorded.'}</p></section>{viewingViolation.status === 'OPEN' && <button type="button" onClick={()=>{setViewingViolation(null);startViolationEdit(viewingViolation)}}>Edit audited record</button>}</div></Modal>}
        </>
      )
    }

    /*
     * ==========================================================
     * COMMUNITY SERVICE
     * ==========================================================
     */

    if (
      activeView === 'Community Service'
    ) {
      const serviceViolations = eligibleServiceViolations(
        violations,
        communityServiceAssignments,
        communityServiceForm.student_id
      )
      const departmentOptions = serviceDepartmentOptions(communityServiceDestinations)
      const departmentHeads = headsForDepartment(communityServiceDestinations, communityServiceForm.department_id)
      const activeAssignments = communityServiceAssignments.filter((item) => !['COMPLETED', 'CLEARED'].includes(String(item.status).toUpperCase()))
      const timedInAssignments = communityServiceAssignments.filter((item) => ['TIMED_IN', 'IN_PROGRESS'].includes(String(item.status).toUpperCase())).length
      const nearCompletionAssignments = activeAssignments.filter((item) => Number(item.remaining_hours) > 0 && Number(item.remaining_hours) <= 2).length
      const completedAssignments = communityServiceAssignments.filter((item) => ['COMPLETED', 'CLEARED'].includes(String(item.status).toUpperCase())).length
      const visibleAssignments = communityServiceAssignments.filter((item) => {
        const query = serviceTableFilters.search.trim().toLowerCase()
        const matchesSearch = !query || [item.first_name, item.last_name, item.student_number, item.department_name, item.department_code].filter(Boolean).join(' ').toLowerCase().includes(query)
        const matchesStatus = serviceTableFilters.status === 'ALL' || String(item.status || 'OPEN').toUpperCase() === serviceTableFilters.status
        const departmentValue = String(item.department_id || item.department_code || '')
        const matchesDepartment = serviceTableFilters.department === 'ALL' || departmentValue === serviceTableFilters.department
        return matchesSearch && matchesStatus && matchesDepartment
      })
      return (
        <>
          <header className="management-page-header">
            <div><span className="page-breadcrumb">Home / Community Service</span><h2>Community Service</h2><p>Track assignments, time logs, accountable departments, and student progress.</p></div>
            <button type="button" className="primary-action" onClick={() => { setCommunityServiceFormError(''); setCommunityServiceFormSuccess(''); setIsCommunityServiceFormOpen(true) }}>＋ Assign Service</button>
          </header>
          <section className="management-metrics management-metrics--five" aria-label="Community service summary">
            <article className="management-metric metric-blue"><i>◎</i><div><strong>{activeAssignments.length}</strong><span>Active Assignments</span></div></article>
            <article className="management-metric metric-green"><i>◷</i><div><strong>{timedInAssignments}</strong><span>Students Timed In</span></div></article>
            <article className="management-metric metric-orange"><i>⚑</i><div><strong>{nearCompletionAssignments}</strong><span>Near Completion</span></div></article>
            <article className="management-metric metric-red"><i>!</i><div><strong>{activeAssignments.filter((item) => Number(item.remaining_hours) >= Number(item.required_hours || 0)).length}</strong><span>Not Started</span></div></article>
            <article className="management-metric metric-green"><i>✓</i><div><strong>{completedAssignments}</strong><span>Completed</span></div></article>
          </section>
          {isCommunityServiceFormOpen && <Modal title="Assign Community Service" drawer onClose={() => setIsCommunityServiceFormOpen(false)}><div className="drawer-intro"><strong>Create a service assignment</strong><span>Connect an open violation to an accountable department head.</span></div>
          <section className="drawer-form-card">
            <div className="table-header">
              <h3>
                Assign community service
              </h3>

              <span>
                New assignment
              </span>
            </div>

            <form
              className="student-form"
              onSubmit={
                handleCommunityServiceSubmit
              }
            >
              <div className="student-form-grid">
                <label>
                  Student

                  <input
                    type="search"
                    name="student_search"
                    list="community-service-student-options"
                    placeholder="Type a student number or name"
                    value={
                      communityServiceForm.student_search
                    }
                    onChange={
                      handleCommunityServiceFieldChange
                    }
                    required
                  />
                  <datalist id="community-service-student-options">
                    {students.map((student) => (
                      <option key={student.id} value={communityServiceStudentLabel(student)} />
                    ))}
                  </datalist>
                  <span>Search by Student Number, first name, or last name, then select the matching result.</span>
                </label>

                <label>
                  Open violation

                  <select
                    name="violation_id"
                    value={
                      communityServiceForm.violation_id
                    }
                    onChange={
                      handleCommunityServiceFieldChange
                    }
                    disabled={!communityServiceForm.student_id}
                    required
                  >
                    <option value="">
                      {communityServiceForm.student_id ? 'Select an open violation' : 'Select a student first'}
                    </option>
                    {serviceViolations.map((violation) => (
                      <option key={violation.id} value={violation.id}>
                        {communityServiceViolationLabel(violation)}
                      </option>
                    ))}
                  </select>
                  {communityServiceForm.student_id && serviceViolations.length === 0 && (
                    <span>This student has no open violation available for a new assignment.</span>
                  )}
                </label>

                <label>
                  Required hours

                  <input
                    type="number"
                    name="required_hours"
                    value={
                      communityServiceForm.required_hours
                    }
                    onChange={
                      handleCommunityServiceFieldChange
                    }
                    min="0"
                    step="1"
                  />
                </label>

                <label>
                  Required minutes
                  <input
                    type="number"
                    name="required_minutes"
                    value={communityServiceForm.required_minutes}
                    onChange={handleCommunityServiceFieldChange}
                    min="0"
                    step="1"
                    inputMode="numeric"
                  />
                  <span>Values of 60 or more are automatically converted to hours.</span>
                </label>

                <label>
                  Service department type
                  <select name="department_id" value={communityServiceForm.department_id} onChange={handleCommunityServiceFieldChange} required>
                    <option value="">Select a department type</option>
                    {departmentOptions.map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Department Head
                  <select name="department_head_id" value={communityServiceForm.department_head_id} onChange={handleCommunityServiceFieldChange} disabled={!communityServiceForm.department_id} required>
                    <option value="">{communityServiceForm.department_id ? 'Select the accountable Department Head' : 'Select a department first'}</option>
                    {departmentHeads.map((head) => (
                      <option key={head.department_head_id} value={head.department_head_id}>{head.first_name} {head.last_name}</option>
                    ))}
                  </select>
                  {communityServiceForm.department_id && departmentHeads.length === 0 && <span>No active Department Head is assigned to this department.</span>}
                </label>
              </div>

              {communityServiceFormError && (
                <p className="error-message">
                  {
                    communityServiceFormError
                  }
                </p>
              )}

              {communityServiceFormSuccess && (
                <p className="success-message">
                  {
                    communityServiceFormSuccess
                  }
                </p>
              )}

              <button
                type="submit"
                className="submit-btn"
              >
                Save Assignment
              </button>
            </form>
          </section></Modal>}

          <section className="table-card">
            <div className="table-header management-table-header">
              <div><h3>Community Service Tracking</h3><p>Required, completed, and remaining time per assignment.</p></div>

              <span>
                {
                  communityServiceAssignments.length
                }{' '}
                assignments
              </span>
            </div>
            <div className="directory-toolbar management-filter-bar"><input type="search" aria-label="Search service assignments" value={serviceTableFilters.search} onChange={(event)=>setServiceTableFilters({...serviceTableFilters,search:event.target.value})} placeholder="Search student, number, or department…"/><select aria-label="Filter service department" value={serviceTableFilters.department} onChange={(event)=>setServiceTableFilters({...serviceTableFilters,department:event.target.value})}><option value="ALL">All departments</option>{departmentOptions.map((department)=><option value={String(department.id)} key={department.id}>{department.name}</option>)}</select><select aria-label="Filter service status" value={serviceTableFilters.status} onChange={(event)=>setServiceTableFilters({...serviceTableFilters,status:event.target.value})}><option value="ALL">All statuses</option><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="CLEARED">Cleared</option></select></div>

            {visibleAssignments.length === 0 ? (
              <p className="empty-state">
                No community service assignments match the selected filters.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="management-record-table">
                  <thead>
                    <tr>
                      <th>
                        ID
                      </th>

                      <th>
                        Student
                      </th>

                      <th>
                        Violation
                      </th>

                      <th>Department</th>

                      <th>Department Head</th>

                      <th>
                        Required
                      </th>

                      <th>
                        Remaining
                      </th>

                      <th>Progress</th>

                      <th>
                        Status
                      </th>

                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleAssignments.map(
                      (assignment) => {
                        const required = Number(assignment.required_hours || 0)
                        const remaining = Number(assignment.remaining_hours ?? required)
                        const progress = required > 0 ? Math.min(100, Math.round(((required - remaining) / required) * 100)) : 0
                        return (
                        <tr
                          key={
                            assignment.id
                          }
                        >
                          <td data-label="Record ID" className="internal-record-id">
                            #{assignment.id}
                          </td>

                          <td data-label="Student">
                            <strong>{assignment.student_number || `Student #${assignment.student_id}`}</strong>
                            {(assignment.first_name || assignment.last_name) && (
                              <span className="table-cell-detail">{assignment.first_name} {assignment.last_name}</span>
                            )}
                          </td>


                          <td data-label="Violation">
                            {
                              `#${assignment.violation_id}`
                            }
                          </td>

                          <td data-label="Department">{assignment.department_code || assignment.department_name || 'Historical assignment'}</td>

                          <td data-label="Department head">{assignment.department_head_first_name || assignment.department_head_last_name ? `${assignment.department_head_first_name || ''} ${assignment.department_head_last_name || ''}`.trim() : 'Not recorded'}</td>

                          <td data-label="Required">
                            {formatDuration(assignment.required_hours)}
                          </td>

                          <td data-label="Remaining">
                            {formatDuration(assignment.remaining_hours ?? assignment.required_hours ?? 0)}
                          </td>

                          <td data-label="Progress"><div className="table-progress"><div><span style={{width:`${progress}%`}} /></div><small>{progress}%</small></div></td>

                          <td data-label="Status">
                            <span className="status-badge">
                              {
                                assignment.status ||
                                'OPEN'
                              }
                            </span>
                          </td>
                          <td data-label="Action"><button type="button" className="primary-row-action" onClick={()=>setViewingServiceAssignment(assignment)}>View</button></td>
                        </tr>
                        )
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {viewingServiceAssignment && (() => { const required = Number(viewingServiceAssignment.required_hours || 0); const remaining = Number(viewingServiceAssignment.remaining_hours ?? required); const completed = Math.max(0, required - remaining); const progress = required > 0 ? Math.min(100, Math.round((completed / required) * 100)) : 0; return <Modal title={`Service assignment #${viewingServiceAssignment.id}`} drawer onClose={()=>setViewingServiceAssignment(null)}><div className="record-detail-drawer"><header><div><span className="page-breadcrumb">Community service assignment</span><h3>{[viewingServiceAssignment.first_name, viewingServiceAssignment.last_name].filter(Boolean).join(' ') || viewingServiceAssignment.student_number || 'Student record'}</h3><p>{viewingServiceAssignment.student_number || `Student #${viewingServiceAssignment.student_id}`}</p></div><span className="status-badge">{viewingServiceAssignment.status || 'OPEN'}</span></header><dl><div><dt>Violation</dt><dd>#{viewingServiceAssignment.violation_id}</dd></div><div><dt>Department</dt><dd>{viewingServiceAssignment.department_name || viewingServiceAssignment.department_code || 'Historical assignment'}</dd></div><div><dt>Department head</dt><dd>{[viewingServiceAssignment.department_head_first_name, viewingServiceAssignment.department_head_last_name].filter(Boolean).join(' ') || 'Not recorded'}</dd></div><div><dt>Required time</dt><dd>{formatDuration(required)}</dd></div><div><dt>Completed time</dt><dd>{formatDuration(completed)}</dd></div><div><dt>Remaining time</dt><dd>{formatDuration(remaining)}</dd></div></dl><section><div className="record-progress-heading"><h4>Service progress</h4><strong>{progress}%</strong></div><div className="record-progress"><span style={{width:`${progress}%`}} /></div></section></div></Modal> })()}
        </>
      )
    }

    /*
     * ==========================================================
     * QR SCAN
     * ==========================================================
     */

    if (activeView === 'QR Scan') {
      const scannerDepartments = serviceDepartmentOptions(communityServiceDestinations)
      const assignedDepartmentId = Number(user?.department_id)
      const assignedDepartments = isDepartmentHead && Number.isInteger(assignedDepartmentId) && assignedDepartmentId > 0
        ? [{ id:assignedDepartmentId, name:user?.department_name||'Assigned department', code:user?.department_code||'' }]
        : scannerDepartments
      return <DepartmentQrScanner form={qrForm} result={qrResult} error={qrError} verifiedQr={verifiedQr}
        isScanning={isQrScanning} isSubmitting={qrSubmitting} departments={assignedDepartments} recorder={user}
        recentScans={recentQrScans} onFieldChange={handleQrFieldChange} onStartCamera={()=>startQrScanner()}
        onStopCamera={()=>stopQrScanner()} onSwitchCamera={switchQrCamera} onAction={handleQrAction}/>
    }


    /*
     * ==========================================================
     * CLEARANCE
     * ==========================================================
     */

    if (activeView === 'Clearance') return <AdminClearanceCertificates token={token} />

    /*
     * ==========================================================
     * REPORTS
     * ==========================================================
     */

    if (
      activeView === 'Reports'
    ) {
      return (
        <div className="reports-workspace">
          <header className="management-page-header">
            <div><span className="page-breadcrumb">Home / Reports</span><h2>Reports</h2><p>Generate operational reports using current records and supported filters.</p></div>
          </header>
          <section className="table-card report-filter-card">
            <div className="table-header management-table-header"><div><h3>Filters</h3><p>Choose a report type, scope, date range, and sort order.</p></div><span>{reportData.length ? `${reportData.length} current results` : 'Ready to generate'}</span></div>

            {reportError && <p className="error-message" role="alert">{reportError}</p>}

            <div
              className="student-form-grid"
              style={{
                marginBottom: '16px'
              }}
            >
              <label>
                Search

                <input type="search" name="search" value={reportFilters.search} onChange={handleReportFilterChange} placeholder="Student or violation" disabled={reportType !== 'violations'} />
              </label>

              <label>
                Report Type

                <select
                  value={reportType}
                  onChange={(event) => {
                    setReportType(
                      event.target.value
                    )

                    setReportData([])
                    setReportFilters((current) => ({ ...current, status: '', from_date: '', to_date: '', sort_by: defaultReportSort(event.target.value) }))
                  }}
                >
                  <option value="violations">
                    Violations Report
                  </option>

                  <option value="community-service">
                    Community Service Report
                  </option>

                  <option value="dtr">
                    DTR / Attendance Report
                  </option>

                  <option value="non-compliance">
                    Non-Compliance Report
                  </option>
                  <option value="parent-contacts">Guardian Contact Report</option>
                  <option value="clearance">Clearance Report</option>
                  <option value="good-standing">Good-Standing Report</option>
                </select>
              </label>

              <label>
                Status Filter

                <select
                  name="status"
                  value={
                    reportFilters.status
                  }
                  onChange={
                    handleReportFilterChange
                  }
                >
                  <option value="">
                    All
                  </option>

                  <option value="OPEN">
                    OPEN
                  </option>

                  <option value="IN_PROGRESS">
                    IN PROGRESS
                  </option>

                  <option value="COMPLETED">
                    COMPLETED
                  </option>

                  <option value="CLEARED">
                    CLEARED
                  </option>
                </select>
              </label>

              <label>
                Student ID

                <input
                  type="number"
                  name="student_id"
                  value={
                    reportFilters.student_id
                  }
                  onChange={
                    handleReportFilterChange
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                Sort By

                <select
                  name="sort_by"
                  value={
                    reportFilters.sort_by
                  }
                  onChange={
                    handleReportFilterChange
                  }
                >
                  {reportSortOptions(reportType).map((sort)=><option value={sort} key={sort}>{sort.replaceAll('_',' ')}</option>)}
                </select>
              </label>

              <label>
                From Date

                <input
                  type="date"
                  name="from_date"
                  value={
                    reportFilters.from_date
                  }
                  onChange={
                    handleReportFilterChange
                  }
                />
              </label>

              <label>
                To Date

                <input
                  type="date"
                  name="to_date"
                  value={
                    reportFilters.to_date
                  }
                  onChange={
                    handleReportFilterChange
                  }
                />
              </label>
            </div>

            <div className="report-filter-actions">
              <button
                className="secondary-button"
                onClick={
                  fetchReport
                }
                disabled={
                  reportLoading
                }
              >
                {reportLoading
                  ? 'Loading...'
                  : 'Generate Report'}
              </button>

              <button
                className="submit-btn"
                onClick={
                  exportReportCSV
                }
                disabled={
                  reportLoading || (reportType !== 'violations' && reportData.length === 0)
                }
              >
                Export CSV
              </button>
            </div>
          </section>

          <section className="table-card report-results-card">
            <div className="table-header management-table-header">
              <div><h3>Generated Report</h3><p>Results use the live data available to your role.</p></div>

              <span>
                {reportData.length}{' '}
                records
              </span>
            </div>

            {reportLoading ? <p className="empty-state" role="status">Generating your report…</p> : reportData.length === 0 ? (
              <p className="empty-state">
                {reportError ? 'The report could not be generated. Review the message above and try again.' : reportGenerated ? 'No records match these filters. Try a wider date range or another status.' : 'Choose filters and generate a report to see results.'}
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {Object.keys(
                        reportData[0] || {}
                      ).map(
                        (key) => (
                          <th key={key}>
                            {reportColumnLabel(key)}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {reportData
                      .slice((reportPage - 1) * 50, reportPage * 50)
                      .map(
                        (row, idx) => (
                          <tr
                            key={idx}
                          >
                            {Object.values(
                              row
                            ).map(
                              (
                                value,
                                cellIdx
                              ) => (
                                <td
                                  key={
                                    cellIdx
                                  }
                                >
                                  {reportCell(Object.keys(row)[cellIdx], value)}
                                </td>
                              )
                            )}
                          </tr>
                        )
                      )}
                  </tbody>
                </table>
              </div>
            )}
            {reportData.length > 50 && <nav className="report-pagination" aria-label="Report result pages"><button type="button" className="secondary-button" disabled={reportPage === 1} onClick={() => setReportPage((page) => page - 1)}>Previous</button><span role="status">Page {reportPage} of {Math.ceil(reportData.length / 50)} · {reportData.length} records</span><button type="button" className="secondary-button" disabled={reportPage >= Math.ceil(reportData.length / 50)} onClick={() => setReportPage((page) => page + 1)}>Next</button></nav>}
          </section>
        </div>
      )
    }

    /*
     * ==========================================================
     * ADMIN DASHBOARD
     * ==========================================================
     */

    return (
      <>
        <section className="stats-grid">
          {dashboardStats.map(
            (stat) => (
              <article
                className="stat-card"
                key={stat.label}
              >
                <span>
                  {stat.label}
                </span>

                <strong>
                  {stat.value}
                </strong>
              </article>
            )
          )}
        </section>

        <section className="table-card dashboard-summary">
          <div className="table-header">
            <h3>
              Violation dashboard
            </h3>

            <span>
              {dashboardLoading
                ? 'Loading...'
                : `${violations.length} entries`}
            </span>
          </div>

          <div className="dashboard-summary-grid">
            <div>
              <h4>
                At-a-glance
              </h4>

              <ul>
                <li>
                  Open cases:{' '}
                  {openViolationsCount}
                </li>

                <li>
                  Pending service:{' '}
                  {studentsOnService}
                </li>

                <li>
                  Cleared cases:{' '}
                  {clearedViolations}
                </li>
              </ul>
            </div>

            <div>
              <h4>
                Most recent records
              </h4>

              <ul>
                {violations
                  .slice(0, 4)
                  .map(
                    (violation) => (
                      <li
                        key={
                          violation.id
                        }
                      >
                        #{violation.id} ·
                        Student{' '}
                        {
                          violation.student_id
                        } ·{' '}
                        {
                          violation.status
                        }
                      </li>
                    )
                  )}

                {violations.length ===
                  0 && (
                  <li>
                    No violations
                    available.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </section>

        <section className="table-card">
          <div className="table-header">
            <h3>
              Student roster
            </h3>

            <span>
              {dashboardLoading
                ? 'Loading...'
                : `${students.length} records`}
            </span>
          </div>

          {students.length === 0 &&
          !dashboardLoading ? (
            <p className="empty-state">
              No student records returned
              for the current account.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      Student
                    </th>

                    <th>
                      Program
                    </th>

                    <th>
                      Section
                    </th>

                    <th>
                      Year
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {students.map(
                    (student) => (
                      <tr
                        key={
                          student.id
                        }
                      >
                        <td>
                          <div className="student-cell">
                            <OffenseIndicator level={student.offense_indicator_level} compact />
                            <span><strong>{student.first_name} {student.last_name}</strong><small>{student.student_number}</small></span>
                          </div>
                        </td>

                        <td>
                          {
                            student.program ||
                            '—'
                          }
                        </td>

                        <td>
                          {
                            student.section ||
                            '—'
                          }
                        </td>

                        <td>
                          {
                            student.year_level ||
                            '—'
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="table-card">
          <div className="table-header">
            <h3>
              Recent violations
            </h3>

            <span>
              {dashboardLoading
                ? 'Loading...'
                : `${violations.length} entries`}
            </span>
          </div>

          {violations.length === 0 &&
          !dashboardLoading ? (
            <p className="empty-state">
              No violations available.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      ID
                    </th>

                    <th>
                      Student
                    </th>

                    <th>Incident</th>

                    <th>
                      Status
                    </th>

                    <th>Required service</th>
                  </tr>
                </thead>

                <tbody>
                  {violations
                    .slice(0, 8)
                    .map(
                      (violation) => (
                        <tr
                          key={
                            violation.id
                          }
                        >
                          <td>
                            #{violation.id}
                          </td>

                          <td>
                            <div className="student-cell">
                              <OffenseIndicator level={violation.offense_indicator_level} compact />
                              <span><strong>{violation.student_name || 'Student record'}</strong><small>{violation.student_number || 'Number unavailable'}</small></span>
                            </div>
                          </td>

                          <td>{formatIncidentDateTime(violation.incident_date, violation.incident_time)}</td>

                          <td>
                            <span className="status-badge">
                              {
                                violation.status
                              }
                            </span>
                          </td>

                          <td>
                            {formatDuration(violation.required_service_hours)}
                          </td>
                        </tr>
                      )
                    )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    )
  }

  /*
   * ============================================================
   * MAIN APPLICATION LAYOUT
   * ============================================================
   */

  return (
    <div className={`app-shell ${!isLoggedIn ? 'auth-shell' : ''}${isLoggedIn && isSidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {isLoggedIn && isMobileNavOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      {isLoggedIn && <aside className={`sidebar ${isMobileNavOpen ? 'mobile-open' : ''}`} id="portal-navigation" aria-label="Portal navigation">
        <div className="brand">
          <img
            className="brand-logo"
            src={stiVioLogLogo}
            alt="STI Vio-Log Discipline Office Portal"
          />

          <button
            className="sidebar-close"
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileNavOpen(false)}
          >
            <span aria-hidden="true">×</span>
          </button>
          <button className="sidebar-collapse" type="button" aria-label={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!isSidebarCollapsed} onClick={() => setIsSidebarCollapsed((value) => !value)}>
            <PortalIcon name="menu" />
          </button>
        </div>

        <nav className="nav" aria-label="Primary navigation">
          {navGroups.map((group) => <div className="nav-group" key={group.name}>
            {group.name !== 'Overview' && <span className="nav-group-label">{group.name}</span>}
            {group.items.map((item) => (
              <button
                key={item.path}
                className={`nav-item ${
                  routePath === item.path
                    ? 'active'
                    : ''
                }`}
                onClick={() => {
                  if (isQrScanning && item.view !== 'QR Scan') stopQrScanner()
                  setIsMobileNavOpen(false)
                  navigateTo(item.path)
                }}
                type="button"
                aria-current={routePath === item.path ? 'page' : undefined}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <span className="nav-item-label"><PortalIcon name={iconNameForView(item.view)}/><span>{item.label}</span></span>
                {item.view === 'Messages' && formatUnreadMessageCount(unreadMessages) && (
                  <span className="nav-pending-badge" aria-label={`${formatUnreadMessageCount(unreadMessages)} unread messages`}>
                    {formatUnreadMessageCount(unreadMessages)}
                  </span>
                )}
                {formatPendingRegistrationCount(
                  item.view === 'Registrations'
                    ? pendingAccountCounts.students
                    : 0
                ) && (
                  <span className="nav-pending-badge" aria-label={`${item.label}: ${pendingAccountCounts.students} pending`}>
                    {formatPendingRegistrationCount(pendingAccountCounts.students)}
                  </span>
                )}
              </button>
            ))}
          </div>)}
          <div className="nav-account-actions">
            <button type="button" className="nav-item" title={isSidebarCollapsed ? 'Logout' : undefined} onClick={handleLogout}><span className="nav-item-label"><PortalIcon name="logout"/><span>Logout</span></span></button>
          </div>
        </nav>
      </aside>}

      <main className="main-panel" id="main-content" tabIndex="-1">
        {isLoggedIn && <header className="topbar">
          <div className="topbar-title">
            <button
              className="mobile-menu-button"
              type="button"
              aria-controls="portal-navigation"
              aria-expanded={isMobileNavOpen}
              aria-label="Open navigation menu"
              onClick={() => setIsMobileNavOpen(true)}
            >
              <span aria-hidden="true">☰</span>
            </button>

            <button className="mobile-brand" type="button" onClick={() => navigateTo(getHomePath(userRole))} aria-label="STI Vio-Log home">
              <img src={stiVioLogLogo} alt="" />
              <span>STI Vio-Log</span>
            </button>

            {(isAdmin || isDepartmentHead) && <form className="topbar-search" role="search" onSubmit={(event)=>{event.preventDefault(); navigateTo(isAdmin?'/admin/students':'/department/students')}}>
              <PortalIcon name="search"/><label className="sr-only" htmlFor="student-directory-search">Search students</label><input id="student-directory-search" type="search" value={studentRosterSearch} onChange={(event)=>setStudentRosterSearch(event.target.value)} placeholder={isDepartmentHead?'Search assigned students…':'Search student directory…'}/>
            </form>}
          </div>

          {isLoggedIn && (
            <div className="account-actions">
              <button className="notification-button" type="button" aria-label={`${studentNotifications.filter((item)=>!item.is_read).length} unread notifications`} onClick={()=>navigateTo(isStudent?'/student/notifications':userRole==='DEPARTMENT_HEAD'?'/department/notifications':userRole==='SYSTEM_ADMIN'?'/system/notifications':'/admin/notifications')}><PortalIcon name="bell"/>{studentNotifications.some((item)=>!item.is_read)&&<b>{studentNotifications.filter((item)=>!item.is_read).length}</b>}</button>
              <ProfileMenu user={user} routePath={routePath} onNavigate={navigateTo} onLogout={handleLogout}/>
            </div>
          )}
        </header>}

        {activeSupportGrant&&<div className="support-access-banner" role="status"><strong>Temporary support access active</strong><span>Read-only · {activeSupportGrant.affected_module} · expires {formatManilaDateTime(activeSupportGrant.expires_at)}</span></div>}
        <div className="page-content"><RouteErrorBoundary key={routePath}><Suspense fallback={<div className="route-loading" role="status">Loading page…</div>}>{renderContent()}</Suspense></RouteErrorBoundary></div>
        {isLoggedIn && <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{mobileNavItems.map((item)=><button type="button" className={routePath===item.path?'active':''} key={item.path} onClick={()=>navigateTo(item.path)}><PortalIcon name={iconNameForView(item.view)}/><span>{item.label.replace('My ','')}</span>{item.view==='Messages'&&unreadMessages>0&&<b>{unreadMessages}</b>}</button>)}<button type="button" onClick={()=>setIsMobileNavOpen(true)}><PortalIcon name="more"/><span>More</span></button></nav>}
      </main>
    </div>
  )
}

export default App
