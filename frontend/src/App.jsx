import './styles/avatars.css'
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { cameraUnavailableMessage, scannerQrBox } from './lib/departmentScanner.js'
const LoginPage = lazy(() => import('./components/LoginPage.jsx'))
const DepartmentDashboard = lazy(() => import('./components/DepartmentDashboard.jsx'))
const DepartmentCommunityService = lazy(() => import('./components/DepartmentCommunityService.jsx'))
const DepartmentQrScanner = lazy(() => import('./components/DepartmentQrScanner.jsx'))
const DepartmentReports = lazy(() => import('./components/DepartmentReports.jsx'))
import DepartmentDtr from './components/DepartmentDtr.jsx'
import ServiceHourCorrections from './components/ServiceHourCorrections.jsx'
import DepartmentNonCompliance from './components/DepartmentNonCompliance.jsx'
import DepartmentStudents from './components/DepartmentStudents.jsx'
const StudentManagement = lazy(() => import('./components/StudentManagement.jsx'))
const StudentRecordDrawer = lazy(() => import('./components/StudentRecordDrawer.jsx'))
import GuardianContactPanel from './components/GuardianContactPanel.jsx'
import Modal from './components/Modal.jsx'
import RouteStatePage from './components/RouteStatePage.jsx'
import RouteErrorBoundary from './components/RouteErrorBoundary.jsx'
const StudentDashboard = lazy(() => import('./components/StudentDashboard.jsx'))
const StudentCommunityService = lazy(() => import('./components/StudentCommunityService.jsx'))
const StudentClearance = lazy(() => import('./components/StudentClearance.jsx'))
const StudentNotifications = lazy(() => import('./components/StudentNotifications.jsx'))
const MessagesPage = lazy(() => import('./components/MessagesPage.jsx'))
const StudentProfile = lazy(() => import('./components/StudentProfile.jsx'))
const StaffProfile = lazy(() => import('./components/StaffProfile.jsx'))
const StudentQr = lazy(() => import('./components/StudentQr.jsx'))
const StudentViolations = lazy(() => import('./components/StudentViolations.jsx'))
const AdminDuplicateReview = lazy(() => import('./components/AdminDuplicateReview.jsx'))
const PasswordChangeRequired = lazy(() => import('./components/PasswordChangeRequired.jsx'))
const StudentOnboarding = lazy(() => import('./components/StudentOnboarding.jsx'))
const AdminAuditLog = lazy(() => import('./components/AdminAuditLog.jsx'))
const AdminDepartmentOfficers = lazy(() => import('./components/AdminDepartmentOfficers.jsx'))
const AdminAccountSettings = lazy(() => import('./components/AdminAccountSettings.jsx'))
const AdminClearanceCertificates = lazy(() => import('./components/AdminClearanceCertificates.jsx'))
import OffenseIndicator from './components/OffenseIndicator.jsx'
const AccountSecuritySettings = lazy(() => import('./components/AccountSecuritySettings.jsx'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard.jsx'))
const DashboardAnalytics = lazy(() => import('./components/DashboardAnalytics.jsx'))
const AdminActiveAttendance = lazy(() => import('./components/AdminActiveAttendance.jsx'))
const ViolationManagement = lazy(() => import('./components/ViolationManagement.jsx'))
const ViolationDetailsDrawer = lazy(() => import('./components/ViolationDetailsDrawer.jsx'))
const ViolationEditDrawer = lazy(() => import('./components/ViolationEditDrawer.jsx'))
const StudentServiceTimeDrawer = lazy(() => import('./components/StudentServiceTimeDrawer.jsx'))
const SystemDashboard = lazy(() => import('./components/SystemDashboard.jsx'))
const ServiceResultReview = lazy(() => import('./components/ServiceResultReview.jsx'))
import PortalIcon from './components/PortalIcon.jsx'
const CommunityServiceManagement = lazy(() => import('./components/CommunityServiceManagement.jsx'))

import { attendanceTransitions } from './lib/attendanceStatus.js'
import ProfileMenu from './components/ProfileMenu.jsx'
import AsyncActionButton from './components/AsyncActionButton.jsx'
import StudentCredentialsModal from './components/StudentCredentialsModal.jsx'
import { isValidStudentGmail, normalizeStudentGmail } from './lib/studentAccount.js'
const PublicPolicyPage = lazy(() => import('./components/PublicPolicyPage.jsx'))
import { API_URL, apiRequest, loadAllPages, login } from './lib/api.js'
import { applyTheme, readDocumentTheme } from './lib/theme.js'
import { getHomePath, getNavItems, resolveRoute } from './lib/routes.js'
import { buildDepartmentDtrQuery } from './lib/departmentDtr.js'
import { nonComplianceSortQuery } from './lib/departmentNonCompliance.js'
import { buildViolationPayload, offensesForType, selectedViolationType, studentIdFromSearch, studentOptionLabel } from './lib/violationAdmin.js'
import stiVioLogLogo from './assets/sti-logo-web.png'
import stiVioLogLogoTransparent from './assets/sti-logo-web-transparent.png'
import { clearSession, loadSession, saveSession } from './lib/session.js'
import { restoreSession } from './lib/restoreSession.js'
import { buildAdminReportQuery, defaultReportSort, reportSortOptions } from './lib/adminReports.js'
import { buildCommunityServiceAssignmentPayload, resolveCommunityServiceStudent } from './lib/communityServiceAdmin.js'
import { createDepartmentReportCsv } from './lib/departmentReports.js'
import { reportCell, reportColumnLabel, presentedReportRows } from './lib/reportPresentation.js'
import { connectRealtime } from './lib/realtime.js'
import { formatDisplayLabel } from './lib/displayFormat.js'
import { iconNameForView, mobileNavItemsFor, mobileNavLabel, sidebarNavigationFor, sidebarGroupForPath, sidebarTooltipFor } from './lib/portalNavigation.js'
import { formatActionCount, useActionLock } from './lib/asyncAction.js'
import { applyPageMetadata, metadataForRoute } from './lib/pageMetadata.js'
import { capitalizeWords, digitsOnly, STUDENT_NUMBER_PATTERN } from './lib/inputNormalization.js'
import './App.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const EMPTY_AUTH_DRAFT = { identifier:'', code:'', resetToken:'', newPassword:'', confirmPassword:'', message:'' }
const EMPTY_MFA_DRAFT = { code:'', recovery:false }

function SidebarTooltip({ anchor, text }) {
  const tooltipRef = useRef(null)

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    if (!tooltip || !anchor.isConnected) return
    tooltip.style.visibility = 'hidden'
    const trigger = anchor.getBoundingClientRect()
    const { width, height } = tooltip.getBoundingClientRect()
    const gap = 8
    const right = trigger.right + gap
    tooltip.style.left = `${right + width <= window.innerWidth - gap ? right : Math.max(gap, trigger.left - width - gap)}px`
    tooltip.style.top = `${Math.max(gap, Math.min(window.innerHeight - height - gap, trigger.top + (trigger.height - height) / 2))}px`
    tooltip.style.visibility = 'visible'
  }, [anchor, text])

  return createPortal(<div className="sidebar-tooltip" role="tooltip" ref={tooltipRef}>{text}</div>, document.body)
}

function SessionRestoringScreen({ error, onRetry, onSignOut }) {
  return (
    <section className="session-restoring-screen" role={error ? 'alert' : 'status'} aria-live="polite" aria-label={error ? 'Session verification failed' : 'Restoring your secure session'}>
      <div className="session-restoring-card">
        <img src={stiVioLogLogo} alt="STI Vio-Log" width="420" height="236" />
        <div className="session-restoring-copy">
          <p className="session-restoring-eyebrow">Secure student discipline portal</p>
          <h1>{error ? 'Connection interrupted' : 'Welcome Back'}</h1>
          <p>{error ? 'We could not verify your session. Check your connection and try again.' : 'Restoring your secure session. This should only take a moment.'}</p>
        </div>
        {error ? <div className="session-restoring-actions"><button type="button" className="submit-btn" onClick={onRetry}>Try again</button><button type="button" className="secondary-button" onClick={onSignOut}>Sign out</button></div> : <>
          <div className="session-restoring-progress" aria-hidden="true"><span /></div>
          <p className="session-restoring-note"><span aria-hidden="true" /> Verifying account access</p>
        </>}
      </div>
    </section>
  )
}

function App() {
  const [initialSession] = useState(() => {
    const logoutRequested = new URLSearchParams(window.location.search).get('logout') === '1'
    if (!logoutRequested) return loadSession()

    clearSession()
    window.history.replaceState({}, '', '/login')
    return { token: '', user: null }
  })
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
  const [isDesktopNavigation, setIsDesktopNavigation] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [openSidebarGroup, setOpenSidebarGroup] = useState(() => sidebarGroupForPath(sidebarNavigationFor(initialSession.user?.role), routePath))
  const [sidebarTooltip, setSidebarTooltip] = useState(null)
  const sidebarTooltipTimerRef = useRef(null)
  const [theme, setTheme] = useState(() => readDocumentTheme(document))
  const themeTransitionTimerRef = useRef(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [mfaState,setMfaState]=useState(null)
  const [mfaDraft,setMfaDraft]=useState(EMPTY_MFA_DRAFT)
  const [authDraft,setAuthDraft]=useState(EMPTY_AUTH_DRAFT)
  const [authReturnPath,setAuthReturnPath]=useState('/login')
  const [logoutConfirmation,setLogoutConfirmation]=useState(false)
  const [logoutBusy,setLogoutBusy]=useState(false)

  const [token, setToken] = useState('')
  const [user, setUser] = useState(null)
  const [sessionRestoring, setSessionRestoring] = useState(Boolean(initialSession.user))
  const [sessionRestoreError, setSessionRestoreError] = useState(false)
  const [sessionRestoreAttempt, setSessionRestoreAttempt] = useState(0)

  const signOutFailedRestoration = () => {
    clearSession()
    setSessionRestoreError(false)
    setSessionRestoring(false)
    window.history.replaceState({}, '', '/login')
    setRoutePath('/login')
  }

  const toggleTheme = useCallback(() => {
    const root = document.documentElement
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const nextTheme = readDocumentTheme(document) === 'dark' ? 'light' : 'dark'

    window.clearTimeout(themeTransitionTimerRef.current)
    if (!prefersReducedMotion) {
      root.classList.add('theme-transitioning')
    } else {
      root.classList.remove('theme-transitioning')
    }

    applyTheme(nextTheme, document, window.localStorage)
    flushSync(() => {
      setTheme(nextTheme)
    })

    if (!prefersReducedMotion) {
      themeTransitionTimerRef.current = window.setTimeout(() => {
        root.classList.remove('theme-transitioning')
      }, 180)
    }
  }, [])

  useEffect(() => () => {
    window.clearTimeout(themeTransitionTimerRef.current)
    document.documentElement.classList.remove('theme-transitioning')
  }, [])

  useEffect(() => {
    if (!initialSession.user) {
      setSessionRestoring(false)
      return undefined
    }
    if (!sessionRestoring) return undefined
    const controller = new AbortController()
    restoreSession((signal) => apiRequest('/api/auth/session', { signal }), { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        saveSession(data)
        setUser(data.user)
        setToken('cookie-session')
        setSessionRestoring(false)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        if (error?.status === 401) {
          clearSession()
          setUser(null)
          setToken('')
          setSessionRestoring(false)
        } else {
          setSessionRestoreError(true)
        }
      })
    return () => controller.abort()
  }, [initialSession.user, sessionRestoreAttempt, sessionRestoring])

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
  const [studentLiveDtr, setStudentLiveDtr] = useState(null)
  const [studentDtrLoading, setStudentDtrLoading] = useState(false)
  const [studentDtrError, setStudentDtrError] = useState('')
  const studentDtrFiltersRef = useRef({ from: '', to: '' })
  const studentLiveRefreshRef = useRef(false)
  const adminAttendanceRefreshRef = useRef(false)
  const [studentNotifications, setStudentNotifications] = useState([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [activeServiceSessions, setActiveServiceSessions] = useState([])
  const [adminAttendanceReady, setAdminAttendanceReady] = useState(false)
  const [attendanceError, setAttendanceError] = useState('')
  const [attendanceNotices, setAttendanceNotices] = useState([])
  const studentAttendanceSnapshotRef = useRef(null)
  const adminAttendanceSnapshotRef = useRef(null)
  const attendanceAccountRef = useRef(null)
  const [notificationActionError, setNotificationActionError] = useState('')
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [pendingActionCounts, setPendingActionCounts] = useState({ serviceResults: 0, supportAccess: 0, actionRequests: 0 })
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0)
  const [realtimeSocket, setRealtimeSocket] = useState(null)
  const runAction = useActionLock()
  const [mutationBusy, setMutationBusy] = useState({})
  const performMutation = useCallback((key, action) => runAction(key, async () => {
    setMutationBusy((current) => ({ ...current, [key]: true }))
    try { return await action() }
    finally { setMutationBusy((current) => ({ ...current, [key]: false })) }
  }), [runAction])
  const refreshPendingActions = useCallback(() => setPendingRefreshKey((value) => value + 1), [])

  useEffect(() => {
    if (!token || user?.password_change_required || user?.onboarding_required) {
      setRealtimeSocket(null)
      return undefined
    }
    const socket = connectRealtime()
    setRealtimeSocket(socket)
    return () => { socket.disconnect() }
  }, [token, user?.password_change_required, user?.onboarding_required])

  useEffect(() => {
    const expireSession = () => {
      realtimeSocket?.disconnect()
      setRealtimeSocket(null)
      setToken('')
      setUser(null)
      setUnreadMessages(0)
      setUnreadNotificationCount(0)
    }
    window.addEventListener('sti:session-expired', expireSession)
    return () => window.removeEventListener('sti:session-expired', expireSession)
  }, [realtimeSocket])

  useEffect(() => {
    if (!realtimeSocket) return undefined
    const refreshServiceData = () => { setDashboardRefreshKey((current) => current + 1); refreshPendingActions() }
    realtimeSocket.on('community-service:changed', refreshServiceData)
    realtimeSocket.on('notifications:changed', refreshServiceData)
    return () => {
      realtimeSocket.off('community-service:changed', refreshServiceData)
      realtimeSocket.off('notifications:changed', refreshServiceData)
    }
  }, [realtimeSocket, refreshPendingActions])

  const markNotificationRead = async (notificationId) => performMutation(`notification-${notificationId}`, async () => {
    setNotificationActionError('')
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Unable to mark this notification as read.')
      const wasUnread = studentNotifications.some((item) => Number(item.id) === Number(notificationId) && !item.is_read)
      setStudentNotifications((items) => items.map((item) => Number(item.id) === Number(notificationId)
        ? { ...item, is_read: true, read_at: data.notification?.read_at || new Date().toISOString() }
        : item))
      if (wasUnread) setUnreadNotificationCount((count) => Math.max(0, count - 1))
    } catch (error) {
      setNotificationActionError(error.message)
    }
  })

  const acknowledgeNotification = async (notificationId) => performMutation(`notification-${notificationId}`, async () => {
    setNotificationActionError('')
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/acknowledge`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Unable to acknowledge this security notification.')
      const wasUnread = studentNotifications.some((item) => Number(item.id) === Number(notificationId) && !item.is_read)
      setStudentNotifications((items) => items.map((item) => Number(item.id) === Number(notificationId)
        ? { ...item, is_read: true, read_at: data.notification?.read_at, acknowledged_at: data.notification?.acknowledged_at }
        : item))
      if (wasUnread) setUnreadNotificationCount((count) => Math.max(0, count - 1))
    } catch (error) {
      setNotificationActionError(error.message)
    }
  })

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
    email: ''
  })

  const [studentFormError, setStudentFormError] = useState('')
  const [studentFormSuccess, setStudentFormSuccess] = useState('')
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false)
  const [createdStudentCredentials,setCreatedStudentCredentials]=useState(null)
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
  const [serviceTimeStudent, setServiceTimeStudent] = useState(null)

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
    attendance_outcome: '', session_type: '', selected_duration_minutes: null, assignment_id: ''
  })

  const [qrError, setQrError] = useState('')
  const [qrResult, setQrResult] = useState(null)
  const [verifiedQr, setVerifiedQr] = useState('')
  const [qrInputSource, setQrInputSource] = useState('manual')
  const verifiedQrRef = useRef('')
  const qrInputVersionRef = useRef(0)
  const [qrSubmitting, setQrSubmitting] = useState(false)
  const [qrHistory,setQrHistory] = useState([])
  const qrActionRef = useRef(null)
  const qrFormRef = useRef(qrForm)
  qrFormRef.current = qrForm

  const [clearanceRecords, setClearanceRecords] = useState([])

  const [reportType, setReportType] = useState('violations')
  const [reportData, setReportData] = useState([])
  const [reportHourCorrections, setReportHourCorrections] = useState([])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

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

  const markAllNotificationsRead = async (category = 'ALL') => performMutation('notificationsReadAll', async () => {
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
      setUnreadNotificationCount((count) => category === 'ALL' ? 0 : Math.max(0, count - Number(data.updated || 0)))
    } catch (error) { setNotificationActionError(error.message) }
  })

  const sidebarEntries = sidebarNavigationFor(user?.role)
  const activeSidebarGroup = sidebarGroupForPath(sidebarEntries, routePath)
  const isSidebarIconRail = isSidebarCollapsed && isDesktopNavigation

  const hideSidebarTooltip = useCallback(() => {
    window.clearTimeout(sidebarTooltipTimerRef.current)
    setSidebarTooltip(null)
  }, [])
  const sidebarTooltipProps = (label, suppressed = false) => {
    const text = sidebarTooltipFor(label)
    const show = (anchor, delay = 0) => {
      window.clearTimeout(sidebarTooltipTimerRef.current)
      if (!delay) {
        if (anchor.isConnected) setSidebarTooltip({ anchor, text })
      } else {
        sidebarTooltipTimerRef.current = window.setTimeout(() => {
          if (anchor.isConnected) setSidebarTooltip({ anchor, text })
        }, delay)
      }
    }
    return {
      'aria-description': text,
      onPointerEnter: (event) => {
        if (isDesktopNavigation && !suppressed && event.pointerType === 'mouse') show(event.currentTarget, 500)
      },
      onPointerLeave: hideSidebarTooltip,
      onFocus: (event) => {
        if (isDesktopNavigation && !suppressed && event.currentTarget.matches(':focus-visible')) show(event.currentTarget)
      },
      onBlur: hideSidebarTooltip,
      onKeyDown: (event) => { if (event.key === 'Escape') hideSidebarTooltip() }
    }
  }

  useEffect(() => {
    hideSidebarTooltip()
  }, [hideSidebarTooltip, routePath, isSidebarCollapsed, isMobileNavOpen, openSidebarGroup, user?.role, isDesktopNavigation])

  useEffect(() => {
    window.addEventListener('scroll', hideSidebarTooltip, true)
    window.addEventListener('resize', hideSidebarTooltip)
    return () => {
      window.removeEventListener('scroll', hideSidebarTooltip, true)
      window.removeEventListener('resize', hideSidebarTooltip)
      window.clearTimeout(sidebarTooltipTimerRef.current)
    }
  }, [hideSidebarTooltip])

  useEffect(() => {
    setOpenSidebarGroup(activeSidebarGroup)
  }, [routePath, user?.role, activeSidebarGroup])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const updateViewport = (event) => setIsDesktopNavigation(event.matches)
    media.addEventListener('change', updateViewport)
    return () => media.removeEventListener('change', updateViewport)
  }, [])

  const mobileNavItems = mobileNavItemsFor(navItems, user?.role)

  const userRole = user?.role || null

  const isAdmin =
    userRole === 'DISCIPLINE_ADMIN' ||
    userRole === 'DISCIPLINE_OFFICE'

  const isDepartmentHead =
    userRole === 'DEPARTMENT_HEAD'

  const isStudent =
    userRole === 'STUDENT'

  useEffect(() => {
    attendanceAccountRef.current = user?.id
    studentAttendanceSnapshotRef.current = null
    adminAttendanceSnapshotRef.current = null
    setAdminAttendanceReady(false)
    setAttendanceError('')
    setAttendanceNotices([])
  }, [user?.id])

  const acceptStudentAttendance = useCallback((data, requestedAt) => {
    if (attendanceAccountRef.current !== user?.id) return
    if (!Array.isArray(data.sessions)) throw new Error('Invalid attendance response')
    const previous = studentAttendanceSnapshotRef.current
    if (previous && requestedAt < previous.requestedAt) return
    const changes = attendanceTransitions(previous?.sessions, data.sessions)
    studentAttendanceSnapshotRef.current = { sessions: data.sessions, requestedAt }
    setStudentLiveDtr(data)
    setAttendanceError('')
    if (changes.length) setAttendanceNotices(changes)
  }, [user?.id])

  const acceptAdminAttendance = useCallback((data, requestedAt) => {
    if (attendanceAccountRef.current !== user?.id) return
    if (!Array.isArray(data.sessions)) throw new Error('Invalid attendance response')
    const previous = adminAttendanceSnapshotRef.current
    if (previous && requestedAt < previous.requestedAt) return
    adminAttendanceSnapshotRef.current = { requestedAt }
    setActiveServiceSessions(data.sessions)
    setAdminAttendanceReady(true)
    setAttendanceError('')
  }, [user?.id])

  useEffect(() => {
    if (!attendanceNotices.length) return undefined
    const timeout = window.setTimeout(() => setAttendanceNotices([]), 6000)
    return () => window.clearTimeout(timeout)
  }, [attendanceNotices])

  const routeResolution = resolveRoute(routePath, userRole)
  const activeView = routeResolution.status === 'allowed' ? routeResolution.route.view : ''

  useEffect(() => {
    applyPageMetadata(metadataForRoute(routePath, routeResolution.route?.label))
  }, [routePath, routeResolution.route?.label])

  useEffect(() => {
    if (!isMobileNavOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsMobileNavOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isMobileNavOpen])
  const updateUnreadMessages = useCallback((count) => setUnreadMessages(Math.max(0, Number(count) || 0)), [])

  useEffect(() => {
    if (!isLoggedIn || !token) {
      setUnreadMessages(0)
      return undefined
    }
    const controller = new AbortController()
    const refresh = async () => {
      try {
        const response = await fetch(`${API_URL}/api/messages/unread-count`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
        })
        const data = await response.json().catch(() => ({}))
        if (response.ok) setUnreadMessages(Number(data.unread_total || 0))
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
    if (!token || !userRole) {
      setPendingActionCounts({ serviceResults: 0, supportAccess: 0, actionRequests: 0 })
      return undefined
    }

    const controller = new AbortController()
    const headers = { Authorization: `Bearer ${token}` }
    const refresh = async () => {
      const requests = []
      const keys = []
      if (['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE'].includes(userRole)) {
        keys.push('serviceResults')
        requests.push(fetch(`${API_URL}/api/community-service/results/pending`, { headers, signal: controller.signal }))
      }
      if (!requests.length) {
        setPendingActionCounts({ serviceResults: 0, supportAccess: 0, actionRequests: 0 })
        return
      }
      try {
        const responses = await Promise.all(requests)
        const payloads = await Promise.all(responses.map((response) => response.ok ? response.json() : null))
        const next = { serviceResults: 0, supportAccess: 0, actionRequests: 0 }
        keys.forEach((key, index) => {
          const data = payloads[index]
          if (key === 'serviceResults') next[key] = Array.isArray(data?.results) ? data.results.length : 0
        })
        setPendingActionCounts(next)
      } catch (loadError) {
        if (loadError.name !== 'AbortError') setPendingActionCounts({ serviceResults: 0, supportAccess: 0, actionRequests: 0 })
      }
    }
    refresh()
    const interval = window.setInterval(refresh, 30000)
    return () => { controller.abort(); window.clearInterval(interval) }
  }, [token, userRole, pendingRefreshKey])

  const badgeForNavigationItem = (item) => {
    if (item.view === 'Messages') return { count: unreadMessages, label: 'unread messages' }
    if (item.view === 'Notifications') return { count: unreadNotificationCount, label: 'unread notifications' }
    if (item.path === '/admin/community-service') return { count: pendingActionCounts.serviceResults, label: 'pending service reviews' }
    return { count: 0, label: '' }
  }

  const navigateTo = (path, { replace = false } = {}) => {
    hideSidebarTooltip()
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setRoutePath(path)
    setOpenSidebarGroup(sidebarGroupForPath(sidebarEntries, path))
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const goToDashboard = async () => {
    if (isQrScanning) await stopQrScanner()
    setIsMobileNavOpen(false)
    navigateTo(getHomePath(userRole))
  }

  const openPolicy = (path, originPath) => {
    setAuthReturnPath(originPath || '/login')
    navigateTo(path)
  }

  useEffect(() => {
    const handlePopState = () => setRoutePath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (sessionRestoring) return
    if (!isLoggedIn) {
      if (routePath === '/register' || routePath === '/verify-email') {
        setError('Student accounts are created by the Discipline Office. Please sign in or contact an authorized officer.')
        navigateTo('/login', { replace: true })
        return
      }
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

    if (routeResolution.status === 'allowed' && routeResolution.redirectTo) {
      navigateTo(routeResolution.redirectTo, { replace: true })
    }
  }, [isLoggedIn, routePath, routeResolution.redirectTo, routeResolution.route, routeResolution.status, sessionRestoring, user, userRole])

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
      setStudentLiveDtr(null)
      setStudentDtrError('')
      setStudentNotifications([])
      setUnreadNotificationCount(0)
      setActiveServiceSessions([])
      return
    }

    const loadDashboardData = async () => {
      const requestedAt = Date.now()
      setDashboardLoading(true)
      setDashboardError('')

      try {
        const authHeaders = {
          Authorization: `Bearer ${token}`
        }

        /*
         * ======================================================
         * ADMIN / DISCIPLINE OFFICE
         * ======================================================
         */

        if (isAdmin) {
          const [
            allStudents,
            allViolations,
            violationTypesResponse,
            allAssignments,
            clearanceResponse,
            destinationsResponse,
            notificationsResponse,
            activeSessionsResponse
          ] = await Promise.all([
            loadAllPages('/api/students', 'students', { headers: authHeaders }),

            loadAllPages('/api/violations', 'violations', { headers: authHeaders }),

            fetch(`${API_URL}/api/violations/types`, {
              headers: authHeaders
            }),

            loadAllPages('/api/community-service', 'assignments', { headers: authHeaders }),

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
            !violationTypesResponse.ok ||
            !clearanceResponse.ok ||
            !destinationsResponse.ok ||
            !notificationsResponse.ok ||
            !activeSessionsResponse.ok
          ) {
            throw new Error(
              'Unable to load administration data'
            )
          }

          const violationTypesData =
            await violationTypesResponse.json()

          const clearanceData =
            await clearanceResponse.json()

          const destinationsData = await destinationsResponse.json()
          const notificationsData = await notificationsResponse.json()
          const activeSessionsData = await activeSessionsResponse.json()

          setStudents(allStudents)

          setViolations(allViolations)

          setViolationTypes(
            (violationTypesData.violationTypes || []).filter((type) =>
              type.violation_code.startsWith('HANDBOOK_')
            )
          )

          setCommunityServiceAssignments(allAssignments)
          setCommunityServiceDestinations(destinationsData.destinations || [])
          setStudentNotifications(notificationsData.notifications || [])
          setUnreadNotificationCount(Number(notificationsData.summary?.unread || 0))
          acceptAdminAttendance(activeSessionsData, requestedAt)

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
          const [allAssignments, notificationsResponse] = await Promise.all([
            loadAllPages('/api/community-service', 'assignments', { headers: authHeaders }),
            fetch(`${API_URL}/api/notifications?limit=100`, { headers: authHeaders })
          ])
          const notificationsData = await notificationsResponse.json().catch(() => ({}))

          if (!notificationsResponse.ok) throw new Error(notificationsData.message || 'Unable to load assigned community service')

          setStudents([])
          setViolations([])
          setCommunityServiceAssignments(allAssignments)
          setClearanceRecords([])
          setDepartmentDtr(null)
          setDepartmentNonCompliance(null)
          setStudentNotifications(notificationsData.notifications || [])
          setUnreadNotificationCount(Number(notificationsData.summary?.unread || 0))

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
          acceptStudentAttendance(dtrData, requestedAt)
          setStudentDtr((current) => {
            const { from, to } = studentDtrFiltersRef.current
            return (from || to) && current ? { ...current, assignments: dtrData.assignments } : dtrData
          })
          setStudentNotifications(notificationsData.notifications || [])
          setUnreadNotificationCount(Number(notificationsData.summary?.unread || 0))
          setClearanceRecords(clearanceData.clearanceRecords || [])
          setClearanceEligibility(eligibilityData)

          return
        }
      } catch (fetchError) {
        console.error(
          'Dashboard data loading error:',
          fetchError
        )

        setDashboardError(fetchError.message || 'Unable to load dashboard data')
        if (isAdmin || isStudent) setAttendanceError('Attendance updates unavailable. Last loaded status may be outdated.')
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
    dashboardRefreshKey,
    acceptAdminAttendance,
    acceptStudentAttendance
  ])

  const loadStudentDtr = useCallback(async ({ from = '', to = '' } = {}) => {
    studentDtrFiltersRef.current = { from, to }
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
  }, [token])

  const refreshStudentLiveDtr = useCallback(async () => {
    if (!token || !isStudent || studentLiveRefreshRef.current) return
    studentLiveRefreshRef.current = true
    const requestedAt = Date.now()
    try {
      const response = await fetch(`${API_URL}/api/students/me/community-service/dtr`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) throw new Error('Attendance refresh failed')
      acceptStudentAttendance(data, requestedAt)
    } catch {
      setAttendanceError('Attendance updates unavailable. Last loaded status may be outdated.')
    } finally {
      studentLiveRefreshRef.current = false
    }
  }, [isStudent, token, acceptStudentAttendance])

  const refreshAdminAttendance = useCallback(async () => {
    if (!token || !isAdmin || adminAttendanceRefreshRef.current) return
    adminAttendanceRefreshRef.current = true
    const requestedAt = Date.now()
    try {
      const response = await fetch(`${API_URL}/api/community-service/active-sessions`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) throw new Error('Attendance refresh failed')
      acceptAdminAttendance(data, requestedAt)
    } catch {
      setAttendanceError('Attendance updates unavailable. Last loaded status may be outdated.')
    } finally {
      adminAttendanceRefreshRef.current = false
    }
  }, [isAdmin, token, acceptAdminAttendance])

  useEffect(() => {
    if (!token || (!isStudent && !isAdmin)) return undefined
    const refreshLiveAttendance = () => {
      if (isStudent) refreshStudentLiveDtr()
      if (isAdmin) refreshAdminAttendance()
    }
    const refresh = () => { if (document.visibilityState === 'visible') refreshLiveAttendance() }
    const polling = window.setInterval(refresh, 15000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online',refresh)
    realtimeSocket?.on('community-service:changed', refreshLiveAttendance)
    realtimeSocket?.on('connect', refreshLiveAttendance)
    return () => {
      window.clearInterval(polling)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('online',refresh)
      realtimeSocket?.off('community-service:changed', refreshLiveAttendance)
      realtimeSocket?.off('connect', refreshLiveAttendance)
    }
  }, [isAdmin, isStudent, token, realtimeSocket, refreshAdminAttendance, refreshStudentLiveDtr])

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

  const startViolationEdit = (violation) => setEditingViolation(violation)
  const addViolationForStudent = (student) => {
    setReviewedStudent(null)
    setViewingViolation(null)
    setViolationForm({ student_id: student.id, student_search: studentOptionLabel(student), violation_type_id: '', incident_date: '', incident_time: '', exact_offense: '', incident_details: '' })
    setViolationFormError(''); setViolationFormSuccess('')
    navigateTo('/admin/violations')
    setIsViolationFormOpen(true)
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

  const handleViolationChanged = (data, action) => {
    setViolations((current) => current.map((item) => Number(item.id) === Number(data.violation.id) ? { ...item, ...data.violation } : item))
    setDashboardRefreshKey((value) => value + 1)
    refreshPendingActions()
    if (reviewedStudent) loadReviewedStudentHistory(reviewedStudent)
    if (action === 'REOPEN') setEditingViolation((current) => ({ ...current, ...data.violation }))
    else setEditingViolation(null)
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
      [name]: name === 'year_level'
        ? Number(value) || ''
        : name === 'student_number'
          ? digitsOnly(value)
          : ['first_name','middle_name','last_name','suffix'].includes(name)
            ? capitalizeWords(value)
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
    return performMutation('studentCreate', async () => {

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

        suffix:
          studentForm.suffix.trim(),
        email: normalizeStudentGmail(studentForm.email)
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
      if (!isValidStudentGmail(payload.email)) throw new Error('Enter a valid personal Gmail address (@gmail.com).')
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
      setCreatedStudentCredentials({studentId:data.student.id,username:data.account.username,password:data.temporary_password,email:data.student.email})
      setIsStudentFormOpen(false)

      setStudentForm({
        student_number: '',
        first_name: '',
        last_name: '',
        middle_name: '',
        suffix: '',
        email: ''
      })

      // Account creation succeeded even if refreshing the directory fails.
      setStudents((current) => [...current, data.student])
      try {
        setStudents(await loadAllPages('/api/students', 'students', {
          headers: { Authorization: `Bearer ${token}` }
        }))
      } catch {
        setStudentFormSuccess('Student account created. Refresh the directory to reload the student list.')
      }
    } catch (studentError) {
      setStudentFormError(
        studentError.message
      )
    }
    })
  }

  /*
   * ============================================================
   * ADD VIOLATION
   * ============================================================
   */

  const handleViolationSubmit = async (event) => {
    event.preventDefault()
    return performMutation('violationCreate', async () => {

    setViolationFormError('')
    setViolationFormSuccess('')

    try {
      const payload = buildViolationPayload(violationForm)

      if (
        !payload.student_id ||
          !payload.violation_type_id ||
          !payload.incident_date ||
          !violationForm.exact_offense.trim() ||
        !violationForm.incident_details.trim()
      ) {
        throw new Error(
          'Student, classification, exact offense, incident date, and incident details are required.'
        )
      }

      const response =
        await fetch(
          `${API_URL}/api/violations`,
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

      setViolations(await loadAllPages('/api/violations', 'violations', {
        headers: { Authorization: `Bearer ${token}` }
      }))
      setIsViolationFormOpen(false)
      setDashboardRefreshKey((value) => value + 1)
      refreshPendingActions()
    } catch (violationError) {
      setViolationFormError(
        violationError.message
      )
    }
    })
  }

  /*
   * ============================================================
   * COMMUNITY SERVICE
   * ============================================================
   */

  const handleCommunityServiceSubmit =
    async (event) => {
      event.preventDefault()
      return performMutation('serviceCreate', async () => {

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

        setCommunityServiceAssignments(await loadAllPages('/api/community-service', 'assignments', {
          headers: { Authorization: `Bearer ${token}` }
        }))
        setIsCommunityServiceFormOpen(false)
      } catch (assignmentError) {
        setCommunityServiceFormError(
          assignmentError.message
        )
      }
      })
    }

  /*
   * ============================================================
   * QR SCANNER
   * ============================================================
   */

  const startQrScanner = async (facingMode = qrFacingMode, restart = false) => {
    setQrError('')
    setQrResult(null)
    setVerifiedQr('')
    verifiedQrRef.current = ''
    qrInputVersionRef.current += 1

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
          const decodedQr = decodedText.trim()
          qrInputVersionRef.current += 1
          const decodedVersion = qrInputVersionRef.current
          qrFormRef.current = { ...qrFormRef.current, qr_code: decodedQr }
          setQrInputSource('camera')
          setQrForm((current) => ({
            ...current,
            qr_code: decodedQr
          }))

          setVerifiedQr('')
          verifiedQrRef.current = ''
          setQrResult(null)
          setQrError('')

          stopQrScanner(scanner)
            .then(() => decodedVersion===qrInputVersionRef.current && qrActionRef.current('scan', decodedQr))
            .finally(() => { qrDecodeBusyRef.current = false })
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
    if (event.target.name==='service_selection') {setQrForm(current=>({...current,...event.target.value}));return}
    if (event.target.name==='assignment_id') {
      const id=Number(event.target.value)||''
      setQrForm(current=>({...current,assignment_id:id,session_type:'',selected_duration_minutes:null}))
      handleQrAction('scan',qrFormRef.current.qr_code,{assignment_id:id});return
    }
    const { name, value } = event.target
    if (name === 'qr_code') {
      qrFormRef.current = { ...qrFormRef.current, qr_code: value }
      qrInputVersionRef.current += 1
      setQrInputSource('manual')
      sessionStorage.removeItem('service-attendance-qr:'+user.id)
    }

    setQrForm((current) => ({
      ...current,

      [name]:
        ['department_id', 'supervising_officer_id'].includes(name)
          ? Number(value) || ''
          : value
    }))

    if (name === 'qr_code' || name === 'department_id') {
      setVerifiedQr('')
      verifiedQrRef.current = ''
      setQrResult(null)
      setQrError('')
      setQrForm((current) => ({ ...current, supervising_officer_id: '' }))
    }
  }

  const handleQrAction = async (action, qrValue = qrForm.qr_code, options = {}) => {
    const quiet=Boolean(options.quiet)
    const version=qrInputVersionRef.current
    while (qrActionBusyRef.current) {
      if (quiet || action!=='scan') return
      await qrActionBusyRef.current
    }
    if (version!==qrInputVersionRef.current) return false
    let release
    qrActionBusyRef.current = new Promise(resolve=>{release=resolve})
    if (!quiet) {setQrError('');setQrSubmitting(true)}
    const normalizedQr=typeof qrValue==='string'?qrValue.trim():''
    const current=qrFormRef.current
    try {
      if (!normalizedQr) throw new Error('QR code is required.')
      if (action!=='scan'&&normalizedQr!==verifiedQrRef.current) throw new Error('Verify the student before recording attendance.')
      if (action==='time-in'&&(!current.session_type||!current.supervising_officer_id)) throw new Error('Select service time and an authorized supervising officer.')
      const assignmentId=options.assignment_id!==undefined?options.assignment_id:normalizedQr===verifiedQrRef.current?current.assignment_id:undefined
      const response=await fetch(API_URL+'/api/qr/'+action,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({qr_code:normalizedQr,
        ...(assignmentId?{assignment_id:Number(assignmentId)}:{}),
        ...(action==='time-in'?{session_type:current.session_type,selected_duration_minutes:current.selected_duration_minutes,supervising_officer_id:Number(current.supervising_officer_id),notes:current.notes.trim()}:{})})})
      const data=await response.json()
      if(action==='scan'&&version!==qrInputVersionRef.current) return false
      if(!response.ok||!data.success) throw new Error(data.message||'Unable to process attendance.')
      setQrResult(previous=>({...data,session:data.session||(quiet&&previous?.session?.status==='COMPLETED'?previous.session:null),action:quiet?(previous?.action||'scan'):action,message:quiet?previous?.message:data.message}))
      setVerifiedQr(normalizedQr)
      verifiedQrRef.current=normalizedQr
      sessionStorage.setItem('service-attendance-qr:'+user.id,normalizedQr)
      const officers=data.available_officers||[]
      const active=data.active_session||data.session
      const officerId=active?.supervising_officer_user_id||officers.find(officer=>Number(officer.officer_user_id)===Number(user.id))?.officer_user_id||(officers.length===1?officers[0].officer_user_id:'')
      setQrForm(form=>({...form,qr_code:normalizedQr,assignment_id:data.assignment?.id||'',supervising_officer_id:officerId,...(action==='time-in'?{notes:''}:{})}))
      if(data.assignment?.id) {
        const historyResponse=await fetch(API_URL+'/api/community-service/'+data.assignment.id+'/sessions',{headers:{Authorization:'Bearer '+token}})
        const historyData=await historyResponse.json()
        if(historyResponse.ok&&version===qrInputVersionRef.current) setQrHistory(historyData.sessions||[])
      } else setQrHistory([])
      if(action!=='scan') {
        setDashboardRefreshKey(key=>key+1);refreshPendingActions()
        if(isAdmin) refreshAdminAttendance()
      }
      return true
    } catch(failure) {if(version===qrInputVersionRef.current) setQrError(failure.message);return false}
    finally {if(!quiet) setQrSubmitting(false);qrActionBusyRef.current=null;release()}
  }
  qrActionRef.current=handleQrAction

  useEffect(()=>{
    if(activeView!=='QR Scan'||!token||!user?.id) return undefined
    const saved=verifiedQrRef.current||(!qrFormRef.current.qr_code&&sessionStorage.getItem('service-attendance-qr:'+user.id))
    if(saved) qrActionRef.current('scan',saved,{quiet:true})
    const refresh=()=>{
      const code=verifiedQrRef.current
      if(document.visibilityState==='visible'&&code) qrActionRef.current('scan',code,{quiet:true})
    }
    const timer=window.setInterval(refresh,15000)
    document.addEventListener('visibilitychange',refresh)
    window.addEventListener('online',refresh)
    realtimeSocket?.on('community-service:changed',refresh)
    realtimeSocket?.on('connect',refresh)
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',refresh);realtimeSocket?.off('community-service:changed',refresh);realtimeSocket?.off('connect',refresh)}
  },[activeView,token,user?.id,realtimeSocket])

  /*
   * ============================================================
   * LOGIN
   * ============================================================
   */

  const handleSubmit = async (event) => {
    event.preventDefault()
    return runAction('login', async () => {

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

      if(data.mfa_enrollment_required){const setup=await apiRequest('/api/auth/mfa/setup/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});setMfaDraft(EMPTY_MFA_DRAFT);setMfaState({mode:'enroll',...setup,client_time_ms:Date.now()});return}
      if(data.mfa_required){setMfaDraft(EMPTY_MFA_DRAFT);setMfaState({mode:'verify',server_time_ms:data.server_time_ms,totp_period_seconds:data.totp_period_seconds,client_time_ms:Date.now()});return}
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
    })
  }

  const updateOwnAvatar = (avatar) => {
    const updated = { ...user, avatar }
    setUser(updated)
    saveSession({ user: updated })
    setStudentProfile((current) => current ? { ...current, avatar } : current)
  }

  const acceptSession = (data) => {
    saveSession(data)
    setToken('cookie-session')
    setUser(data.user)
    setMfaState(null)
    setMfaDraft(EMPTY_MFA_DRAFT)
    setAuthDraft(EMPTY_AUTH_DRAFT)
    setError('')
    setForm({ username: '', password: '' })
    navigateTo(data.user.password_change_required ? '/account/password-change' : data.user.onboarding_required ? '/student/onboarding' : getHomePath(data.user.role), { replace: true })
  }

  const handleMfaSubmit=async({code,recovery})=>{setIsSubmitting(true);setError('');try{const path=mfaState.mode==='enroll'?'/api/auth/mfa/setup/confirm':recovery?'/api/auth/mfa/recovery':'/api/auth/mfa/verify';const body=mfaState.mode==='enroll'||!recovery?{code}:{recovery_code:code};const data=await apiRequest(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(data.recovery_codes){saveSession(data);setMfaState({mode:'complete',recoveryCodes:data.recovery_codes,pendingSession:data})}else acceptSession(data)}catch(e){setError(e.message)}finally{setIsSubmitting(false)}}
  const cancelMfa=()=>{setMfaState(null);setMfaDraft(EMPTY_MFA_DRAFT);setError('');setForm({username:'',password:''})}
  const continueMfa=()=>acceptSession(mfaState.pendingSession)

  /*
   * ============================================================
   * LOGOUT
   * ============================================================
   */

  const requestLogout = () => { hideSidebarTooltip(); setLogoutConfirmation(true) }

  const handleLogout = async () => {
    if (logoutBusy) return
    setLogoutBusy(true)
    try { await fetch(`${API_URL}/api/auth/logout`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}) } catch { /* local cleanup still completes */ }
    clearSession()

    try {
      realtimeSocket?.disconnect()
    } catch {
      // A stale real-time connection must never prevent local sign-out.
    }
    setRealtimeSocket(null)
    setIsMobileNavOpen(false)

    setToken('')
    setUser(null)
    setError('')
    setMfaState(null)
    setMfaDraft(EMPTY_MFA_DRAFT)
    setAuthDraft(EMPTY_AUTH_DRAFT)
    setLogoutConfirmation(false)

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

    // Force a clean document load after sign-out so Safari cannot retain a
    // protected route or an authenticated in-memory component tree.
    window.location.replace(new URL('/login', window.location.href).href)
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
    setReportHourCorrections([])
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
        setReportHourCorrections(data.hourCorrections || [])
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

  const exportReport = async () => {
    if (reportType !== 'violations' && reportData.length === 0) {
      return
    }

    if (reportType === 'violations') {
      setReportError('')
      try {
        const params = buildAdminReportQuery(reportType, reportFilters)
        const response = await fetch(`${API_URL}/api/reports/violations.xlsx${params ? `?${params}` : ''}`, { headers:{ Authorization:`Bearer ${token}` } })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.message || 'Unable to export this report.')
        }
        const blob = await response.blob()
        const disposition = response.headers.get('content-disposition') || ''
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `violations-report-${new Date().toISOString().slice(0,10)}.xlsx`
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

    if (sessionRestoring) {
      return <SessionRestoringScreen error={sessionRestoreError} onRetry={() => { setSessionRestoreError(false); setSessionRestoreAttempt((attempt) => attempt + 1) }} onSignOut={signOutFailedRestoration} />
    }

    if (routePath === '/privacy' || routePath === '/terms') {
      return <PublicPolicyPage type={routePath.slice(1)} onNavigate={navigateTo} returnPath={authReturnPath} />
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
          onOpenPolicy={openPolicy}
          authDraft={authDraft}
          onAuthDraftChange={setAuthDraft}
          onClearAuthDraft={()=>setAuthDraft(EMPTY_AUTH_DRAFT)}
          mfaState={mfaState}
          mfaDraft={mfaDraft}
          onMfaDraftChange={setMfaDraft}
          onMfaSubmit={handleMfaSubmit}
          onMfaCancel={cancelMfa}
          onMfaContinue={continueMfa}
        />
      )
    }

    if (user?.password_change_required) {
      return <PasswordChangeRequired token={token} user={user} onSession={acceptSession} onLogout={requestLogout} />
    }

    if (user?.role==='STUDENT' && user?.onboarding_required) {
      return <StudentOnboarding user={user} clientId={GOOGLE_CLIENT_ID} onSession={acceptSession} onLogout={requestLogout}/>
    }

    if (userRole === 'DISCIPLINE_ADMIN' && activeView === 'System Dashboard') {
      return <SystemDashboard token={token} user={user} />
    }

    if (activeView === 'Messages') {
      return <MessagesPage token={token} role={userRole} students={students} currentUser={user} onUnreadChange={updateUnreadMessages} realtimeSocket={realtimeSocket} />
    }

    if (activeView === 'Profile' && !isStudent) {
      return <StaffProfile user={user} onNavigate={navigateTo} />
    }

    if (routeResolution.status === 'unauthorized') {
      return <RouteStatePage type="unauthorized" onGoHome={() => navigateTo(getHomePath(userRole))} />
    }

    if (routeResolution.status === 'not_found') {
      return <RouteStatePage type="not_found" onGoHome={() => navigateTo(getHomePath(userRole))} />
    }

    if (activeView === 'Account Settings') {
      if (userRole === 'DISCIPLINE_ADMIN') return <AdminAccountSettings token={token} user={user} onSession={acceptSession} onAvatarChange={updateOwnAvatar} />
      return <AccountSecuritySettings token={token} user={user} onSession={acceptSession} onAvatarChange={updateOwnAvatar} />
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
            liveDtr={studentLiveDtr}
            loading={dashboardLoading || studentDtrLoading}
            error={studentDtrError || dashboardError}
            attendanceError={attendanceError}
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
        return <StudentNotifications notifications={studentNotifications} loading={dashboardLoading} error={notificationActionError || dashboardError} onMarkRead={markNotificationRead} onAcknowledge={acknowledgeNotification} onMarkAll={markAllNotificationsRead} onNavigate={navigateTo} actionBusy={mutationBusy} audience="STUDENT" />
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
          dtr={studentLiveDtr || studentDtr}
          loading={dashboardLoading}
          error={dashboardError}
          attendanceError={attendanceError}
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
      return <StudentNotifications notifications={studentNotifications} loading={dashboardLoading} error={notificationActionError || dashboardError} onMarkRead={markNotificationRead} onAcknowledge={acknowledgeNotification} onMarkAll={markAllNotificationsRead} onNavigate={navigateTo} actionBusy={mutationBusy} audience={isStudent ? 'STUDENT' : 'STAFF'} />
    }

    if (activeView === 'Dashboard') {
      return <AdminDashboard students={students} violations={violations} assignments={communityServiceAssignments} activeSessions={activeServiceSessions} loading={dashboardLoading} error={dashboardError} role={userRole} onNavigate={navigateTo} attendanceReady={adminAttendanceReady} attendanceError={attendanceError} />
    }

    if (isAdmin && activeView === 'Active Attendance') {
      return <AdminActiveAttendance sessions={activeServiceSessions} loading={dashboardLoading} onNavigate={navigateTo} attendanceReady={adminAttendanceReady} attendanceError={attendanceError} token={token} onAttendanceSaved={()=>{refreshAdminAttendance();setDashboardRefreshKey(key=>key+1)}} />
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

    if (userRole === 'DISCIPLINE_ADMIN' && activeView === 'Duplicate Review') {
      return <AdminDuplicateReview token={token} />
    }

    if (userRole === 'DISCIPLINE_ADMIN' && activeView === 'Departments & Officer Accounts') {
      return <AdminDepartmentOfficers token={token} />
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
      return (
        <>
          <StudentManagement students={students} violations={violations} assignments={communityServiceAssignments} clearances={clearanceRecords} activeSessions={activeServiceSessions} attendanceReady={adminAttendanceReady} loading={dashboardLoading} query={studentRosterSearch} onQueryChange={setStudentRosterSearch} token={token}
            onAdd={() => { setStudentFormError(''); setStudentFormSuccess(''); setIsStudentFormOpen(true) }} onView={loadReviewedStudentHistory} onServiceTime={setServiceTimeStudent} onGuardianContact={setGuardianContactStudent}
            onUpdated={(updated) => setStudents((current) => current.map((item) => Number(item.id) === Number(updated.id) ? updated : item))}/>
          {isStudentFormOpen && <Modal title="Add Student" drawer onClose={() => setIsStudentFormOpen(false)}><div className="drawer-intro"><strong>Create the student account</strong><span>Enter the Student Number, official legal name, and personal Gmail address. After creating the account, click Send Email to share the temporary password. The student completes the remaining information during first sign-in.</span></div>
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
                    inputMode="numeric"
                    pattern={STUDENT_NUMBER_PATTERN}
                    maxLength={11}
                    required
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
                    required
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
                    required
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
                  Student Gmail
                  <input
                    type="email"
                    name="email"
                    value={studentForm.email}
                    onChange={handleStudentFieldChange}
                    onBlur={() => setStudentForm((current) => ({...current, email: normalizeStudentGmail(current.email)}))}
                    placeholder="student@gmail.com"
                    autoComplete="email"
                    pattern="[^ @]+@[gG][mM][aA][iI][lL][.][cC][oO][mM]"
                    maxLength={255}
                    aria-describedby="student-gmail-help"
                    required
                  />
                  <span id="student-gmail-help" className="student-gmail-help">Use personal Gmail (@gmail.com). You can email the temporary password after creating the account.</span>
                </label>

              </div>

              {studentFormError && (
                <p className="error-message" role="alert">
                  {studentFormError}
                </p>
              )}

              {studentFormSuccess && (
                <p className="success-message">
                  {studentFormSuccess}
                </p>
              )}

              <AsyncActionButton
                type="submit"
                className="submit-btn"
                busy={mutationBusy.studentCreate}
                busyLabel="Saving student…"
              >
                Save Student
              </AsyncActionButton>
            </form>
          </section></Modal>}
          {createdStudentCredentials && <StudentCredentialsModal credentials={createdStudentCredentials} token={token} onClose={() => setCreatedStudentCredentials(null)}/>}

          {guardianContactStudent && <Modal title="Guardian Contact" className="student-action-modal guardian-contact-modal" drawer onClose={() => setGuardianContactStudent(null)}><GuardianContactPanel key={guardianContactStudent.id} token={token} student={guardianContactStudent} onClose={() => setGuardianContactStudent(null)} showClose={false} /></Modal>}
          {serviceTimeStudent && <StudentServiceTimeDrawer student={serviceTimeStudent} assignments={communityServiceAssignments} activeSessions={activeServiceSessions} attendanceReady={adminAttendanceReady} attendanceError={attendanceError} onClose={() => setServiceTimeStudent(null)} />}

          {reviewedStudent && <StudentRecordDrawer key={reviewedStudent.id} student={reviewedStudent} violations={reviewedStudentViolations} summary={reviewedStudentSummary} loading={reviewedStudentLoading} error={reviewedStudentError} hasMore={reviewedStudentHasMore}
            onLoadMore={() => loadReviewedStudentHistory(reviewedStudent, reviewedStudentPage + 1, true)} assignments={communityServiceAssignments} activeSessions={activeServiceSessions} attendanceReady={adminAttendanceReady} attendanceError={attendanceError} token={token}
            onClose={() => setReviewedStudent(null)} onViewCase={(violation) => { setReviewedStudent(null); navigateTo('/admin/violations'); setViewingViolation(violation) }} onAddViolation={addViolationForStudent}
            onPhotoUpdated={(updated) => { setReviewedStudent(updated); setStudents((current) => current.map((item) => Number(item.id) === Number(updated.id) ? { ...item, avatar: updated.avatar } : item)) }}/>
          }
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
      return (
        <>
          <ViolationManagement violations={violations} loading={dashboardLoading} filters={violationTableFilters} onFiltersChange={setViolationTableFilters} role={userRole} onRecord={() => { setViolationFormError(''); setViolationFormSuccess(''); setIsViolationFormOpen(true) }} onView={setViewingViolation} onEdit={startViolationEdit}/>
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
                    autoComplete="off"
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

              <AsyncActionButton
                type="submit"
                className="submit-btn"
                busy={mutationBusy.violationCreate}
                busyLabel="Saving violation…"
              >
                Save Violation
              </AsyncActionButton>
            </form>
          </section></Modal>}

          {editingViolation && <ViolationEditDrawer key={editingViolation.id + ':' + editingViolation.status} violation={editingViolation} student={students.find((item) => Number(item.id) === Number(editingViolation.student_id))} types={violationTypes} assignments={communityServiceAssignments} destinations={communityServiceDestinations} role={userRole} token={token} onClose={() => setEditingViolation(null)} onChanged={handleViolationChanged}/>}

          {viewingViolation && <ViolationDetailsDrawer violation={viewingViolation} student={students.find((item) => Number(item.id) === Number(viewingViolation.student_id))} role={userRole} onClose={() => setViewingViolation(null)} onEdit={() => { const violation = viewingViolation; setViewingViolation(null); startViolationEdit(violation) }} canAdd={students.some((item) => Number(item.id) === Number(viewingViolation.student_id))} onAdd={() => { const student = students.find((item) => Number(item.id) === Number(viewingViolation.student_id)); if (student) addViolationForStudent(student) }}/>}

        </>
      )
    }

    /*
     * ==========================================================
     * COMMUNITY SERVICE
     * ==========================================================
     */

    if (activeView === 'Community Service') {
      return <CommunityServiceManagement students={students} assignments={communityServiceAssignments}
        activeSessions={activeServiceSessions} attendanceReady={adminAttendanceReady} loading={dashboardLoading}
        filters={serviceTableFilters} onFiltersChange={setServiceTableFilters}
        pendingResults={isAdmin && <ServiceResultReview token={token} onChanged={() => { refreshPendingActions(); setDashboardRefreshKey((current) => current + 1) }} />}
        onAssign={() => { setCommunityServiceFormError(''); setCommunityServiceFormSuccess(''); setIsCommunityServiceFormOpen(true) }}
        formOpen={isCommunityServiceFormOpen} onCloseForm={() => setIsCommunityServiceFormOpen(false)}
        formProps={{ form:communityServiceForm, violations, destinations:communityServiceDestinations,
          busy:mutationBusy.serviceCreate, error:communityServiceFormError, success:communityServiceFormSuccess,
          onFieldChange:handleCommunityServiceFieldChange, onSubmit:handleCommunityServiceSubmit }}
        viewingAssignment={viewingServiceAssignment} onView={setViewingServiceAssignment} onCloseAssignment={() => setViewingServiceAssignment(null)}/>
    }
    if (activeView === 'QR Scan') {
      return <DepartmentQrScanner form={qrForm} result={qrResult} error={qrError} verifiedQr={verifiedQr} inputSource={qrInputSource}
        isScanning={isQrScanning} isSubmitting={qrSubmitting} recorder={user} token={token} history={qrHistory}
        onFieldChange={handleQrFieldChange} onStartCamera={()=>startQrScanner()}
        onStopCamera={()=>stopQrScanner()} onSwitchCamera={switchQrCamera} onAction={handleQrAction}
        onAttendanceSaved={async result=>{setQrResult(current=>({...current,...result,active_session:null,action:'time-out'}));setDashboardRefreshKey(key=>key+1);refreshPendingActions();if(isAdmin) refreshAdminAttendance();await handleQrAction('scan',qrFormRef.current.qr_code,{quiet:true,assignment_id:''})}}/>
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

    if (activeView === 'Analytics & Trends') {
      return <div className="analytics-workspace"><DashboardAnalytics students={students} violations={violations} assignments={communityServiceAssignments} loading={dashboardLoading} error={dashboardError}/></div>
    }

    if (
      activeView === 'Reports'
    ) {
      return (
        <div className="reports-workspace">
          <header className="management-page-header portal-page-header">
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

                <input type="search" name="report-search-filter" autoComplete="off" value={reportFilters.search} onChange={handleReportFilterChange} placeholder="Student or violation" disabled={reportType !== 'violations'} />
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
                  {reportSortOptions(reportType).map((sort)=><option value={sort} key={sort}>{formatDisplayLabel(sort)}</option>)}
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
                  exportReport
                }
                disabled={
                  reportLoading || (reportType !== 'violations' && reportData.length === 0)
                }
              >
                {reportType === 'violations' ? 'Export Excel' : 'Export CSV'}
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
                <table className="responsive-record-table report-record-table">
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
                                  data-label={reportColumnLabel(Object.keys(row)[cellIdx])}
                                  key={
                                    cellIdx
                                  }
                                >
                                  {reportCell(Object.keys(row)[cellIdx], value, row)}
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
            {reportType === 'dtr' && reportGenerated && <ServiceHourCorrections corrections={reportHourCorrections}/>}
            {reportData.length > 50 && <nav className="report-pagination" aria-label="Report result pages"><button type="button" className="secondary-button" disabled={reportPage === 1} onClick={() => setReportPage((page) => page - 1)}>Previous</button><span role="status">Page {reportPage} of {Math.ceil(reportData.length / 50)} · {reportData.length} records</span><button type="button" className="secondary-button" disabled={reportPage >= Math.ceil(reportData.length / 50)} onClick={() => setReportPage((page) => page + 1)}>Next</button></nav>}
          </section>
        </div>
      )
    }

  }

  /*
   * ============================================================
   * MAIN APPLICATION LAYOUT
   * ============================================================
   */

  const renderSidebarPage = (item) => {
    const badge = badgeForNavigationItem(item)
    return (
      <button
        key={item.path}
        className={`nav-item${item.view === 'Messages' ? ' messages-nav-item' : ''}${routePath === item.path ? ' active' : ''}`}
        onClick={() => {
          if (isQrScanning && item.view !== 'QR Scan') stopQrScanner()
          setIsMobileNavOpen(false)
          navigateTo(item.path)
        }}
        type="button"
        aria-label={item.label}
        aria-current={routePath === item.path ? 'page' : undefined}
        {...sidebarTooltipProps(item.label)}
      >
        <span className="nav-item-label"><PortalIcon name={iconNameForView(item.view)}/><span>{item.label}</span></span>
        {formatActionCount(badge.count) && <span className="nav-pending-badge" aria-label={`${formatActionCount(badge.count)} ${badge.label}`}>{formatActionCount(badge.count)}</span>}
      </button>
    )
  }

  return (
    <div className={`app-shell ${!isLoggedIn ? 'auth-shell' : ''}${isLoggedIn && isAdmin ? ' admin-portal' : ''}${isLoggedIn && isSidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
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
          <button className="brand-home" type="button" onClick={goToDashboard} aria-label="Go to dashboard">
            <img
              className="brand-logo"
              src={stiVioLogLogoTransparent}
              alt="STI Vio-Log Discipline Office Portal"
              width="420"
              height="236"
            />
            <img className="brand-favicon" src="/favicon-32.png" alt="STI Vio-Log" width="32" height="32" />
          </button>

          <button
            className="sidebar-close"
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileNavOpen(false)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <nav className="nav" aria-label="Primary navigation">
          {sidebarEntries.map((entry) => {
            if (entry.type === 'page') return renderSidebarPage(entry)
            const expanded = !isSidebarIconRail && openSidebarGroup === entry.id
            return <div className="nav-group" key={entry.id}>
              <button
                type="button"
                id={`sidebar-${entry.id}-toggle`}
                className={`nav-item nav-group-toggle${activeSidebarGroup === entry.id && !expanded ? ' active-section' : ''}`}
                aria-label={entry.label}
                aria-expanded={expanded}
                aria-controls={`sidebar-${entry.id}-pages`}
                {...sidebarTooltipProps(entry.label, expanded)}
                onClick={() => {
                  hideSidebarTooltip()
                  if (isSidebarIconRail) {
                    setIsSidebarCollapsed(false)
                    setOpenSidebarGroup(entry.id)
                  } else {
                    setOpenSidebarGroup((current) => current === entry.id ? null : entry.id)
                  }
                }}
              >
                <span className="nav-item-label"><PortalIcon name={entry.icon}/><span>{entry.label}</span></span>
                <span className="nav-chevron" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
              </button>
              <div className="nav-group-children" id={`sidebar-${entry.id}-pages`} hidden={!expanded}>
                {entry.items.map(renderSidebarPage)}
              </div>
            </div>
          })}
        </nav>
        <div className="nav-account-actions">
          <button type="button" className="nav-item" aria-label="Logout" {...sidebarTooltipProps('Logout')} onClick={requestLogout}><span className="nav-item-label"><PortalIcon name="logout"/><span>Logout</span></span></button>
        </div>
      </aside>}

      {sidebarTooltip && isLoggedIn && isDesktopNavigation && <SidebarTooltip anchor={sidebarTooltip.anchor} text={sidebarTooltip.text} />}

      <main className={`main-panel${activeView === 'Messages' ? ' main-panel--messages' : ''}`} id="main-content" tabIndex="-1">
        {isLoggedIn && <header className="topbar">
          <div className="topbar-title">
            <button
              className="sidebar-collapse"
              type="button"
              aria-label={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-controls="portal-navigation"
              aria-expanded={!isSidebarCollapsed}
              onClick={() => setIsSidebarCollapsed((value) => !value)}
            >
              <PortalIcon name={isSidebarCollapsed ? 'panel-left-open' : 'panel-left-close'} />
            </button>

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

            <button className="mobile-brand" type="button" onClick={goToDashboard} aria-label="Go to dashboard">
              <img className="mobile-brand-logo" src={stiVioLogLogoTransparent} alt="" width="420" height="236" />
              <span>STI Vio-Log</span>
            </button>

            {(isAdmin || isDepartmentHead) && <form className="topbar-search" role="search" onSubmit={(event)=>{event.preventDefault(); navigateTo(isAdmin?'/admin/students':'/department/students')}}>
              <PortalIcon name="search"/><label className="sr-only" htmlFor="student-directory-search">Search students</label><input id="student-directory-search" type="search" name="portal-student-search" autoComplete="off" value={studentRosterSearch} onChange={(event)=>setStudentRosterSearch(event.target.value)} placeholder={isDepartmentHead?'Search assigned students…':'Search students, violations, IDs...'}/>
            </form>}
          </div>

          {isLoggedIn && (
            <div className="account-actions">
              <button
                className="theme-toggle"
                type="button"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                aria-pressed={theme === 'dark'}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                onClick={toggleTheme}
              >
                <PortalIcon name={theme === 'dark' ? 'sun' : 'moon'} />
              </button>
              <button className="notification-button" type="button" aria-label={`${unreadNotificationCount} unread notifications`} onClick={()=>navigateTo(isStudent?'/student/notifications':userRole==='DEPARTMENT_HEAD'?'/department/notifications':'/admin/notifications')}><PortalIcon name="bell"/>{unreadNotificationCount > 0 && <b>{formatActionCount(unreadNotificationCount)}</b>}</button>
              <ProfileMenu user={user} profile={isStudent ? studentProfile : null} routePath={routePath} onNavigate={navigateTo} onLogout={requestLogout}/>
            </div>
          )}
        </header>}

        {!isLoggedIn && <button
          className="theme-toggle auth-theme-toggle"
          type="button"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-pressed={theme === 'dark'}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={toggleTheme}
        ><PortalIcon name={theme === 'dark' ? 'sun' : 'moon'} /></button>}

        {isLoggedIn && (isStudent || isAdmin) && attendanceError && !['Dashboard', 'My Service', 'Active Attendance'].includes(activeView) && <p className="attendance-update-error attendance-global-error">{attendanceError}</p>}
        {isLoggedIn && isStudent && <div className="attendance-notice-region" role="status" aria-live="polite" aria-atomic="true">
          {attendanceNotices.length > 0 && <div className="attendance-notice"><div>{attendanceNotices.map((notice) => <p key={`${notice.sessionId}-${notice.action}`}><strong>{notice.action}</strong> recorded for assignment #{notice.assignmentId}.</p>)}</div><button type="button" className="secondary-button" aria-label="Dismiss attendance notification" onClick={() => setAttendanceNotices([])}>Dismiss</button></div>}
        </div>}
        <div className="page-content"><RouteErrorBoundary key={isLoggedIn?routePath:'public-auth'}><Suspense fallback={<div className="route-loading" role="status">Loading page…</div>}>{renderContent()}</Suspense></RouteErrorBoundary></div>
        {isLoggedIn && <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{mobileNavItems.map((item)=>{const badge=badgeForNavigationItem(item);return <button type="button" className={`${item.view==='Messages'?'messages-nav-item ':''}${routePath===item.path?'active':''}`.trim()} key={item.path} onClick={()=>navigateTo(item.path)}><PortalIcon name={iconNameForView(item.view)}/><span>{mobileNavLabel(item)}</span>{formatActionCount(badge.count)&&<b aria-label={`${formatActionCount(badge.count)} ${badge.label}`}>{formatActionCount(badge.count)}</b>}</button>})}<button type="button" onClick={()=>setIsMobileNavOpen(true)}><PortalIcon name="more"/><span>More</span></button></nav>}
      </main>
      {logoutConfirmation&&<Modal title="Confirm logout" onClose={()=>!logoutBusy&&setLogoutConfirmation(false)}><div className="confirmation-dialog"><p>Are you sure you want to log out of your account?</p><footer className="modal-actions"><button type="button" className="secondary-button" disabled={logoutBusy} onClick={()=>setLogoutConfirmation(false)}>Cancel</button><button type="button" className="danger-button" disabled={logoutBusy} onClick={handleLogout}>{logoutBusy?'Logging out…':'Logout'}</button></footer></div></Modal>}
    </div>
  )
}

export default App
