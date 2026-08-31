import { useCallback, useEffect, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { cameraUnavailableMessage, scannerQrBox } from './lib/departmentScanner.js'
import LoginPage from './components/LoginPage.jsx'
import DepartmentDashboard from './components/DepartmentDashboard.jsx'
import DepartmentCommunityService from './components/DepartmentCommunityService.jsx'
import DepartmentDtr from './components/DepartmentDtr.jsx'
import DepartmentNonCompliance from './components/DepartmentNonCompliance.jsx'
import DepartmentQrScanner from './components/DepartmentQrScanner.jsx'
import DepartmentReports from './components/DepartmentReports.jsx'
import DepartmentStudents from './components/DepartmentStudents.jsx'
import StudentAccessRemoval from './components/StudentAccessRemoval.jsx'
import GuardianContactPanel from './components/GuardianContactPanel.jsx'
import RouteStatePage from './components/RouteStatePage.jsx'
import StudentDashboard from './components/StudentDashboard.jsx'
import StudentCommunityService from './components/StudentCommunityService.jsx'
import StudentClearance from './components/StudentClearance.jsx'
import StudentNotifications from './components/StudentNotifications.jsx'
import MessagesPage from './components/MessagesPage.jsx'
import StudentProfile from './components/StudentProfile.jsx'
import StudentQr from './components/StudentQr.jsx'
import StudentViolations from './components/StudentViolations.jsx'
import GoogleRegistrationReview from './components/GoogleRegistrationReview.jsx'
import DepartmentAccounts from './components/DepartmentAccounts.jsx'
import PasswordChangeRequired from './components/PasswordChangeRequired.jsx'
import AdminAccounts from './components/AdminAccounts.jsx'
import AdminDepartments from './components/AdminDepartments.jsx'
import AdminAuditLog from './components/AdminAuditLog.jsx'
import AdminDuplicateReview from './components/AdminDuplicateReview.jsx'
import ServiceResultReview from './components/ServiceResultReview.jsx'
import { API_URL, login } from './lib/api.js'
import { getHomePath, getNavItems, resolveRoute } from './lib/routes.js'
import { buildDepartmentDtrQuery } from './lib/departmentDtr.js'
import { nonComplianceSortQuery } from './lib/departmentNonCompliance.js'
import { buildViolationPayload, buildViolationUpdatePayload, offensesForType, selectedViolationType, studentIdFromSearch, studentOptionLabel } from './lib/violationAdmin.js'
import { clearSession, loadSession, saveSession } from './lib/session.js'
import { filterAdminStudents, handbookSanctionGuidance, summarizeStudentCondition } from './lib/adminStudentReview.js'
import { formatPendingRegistrationCount, pendingRegistrationCount } from './lib/pendingRegistrations.js'
import { buildCommunityServiceAssignmentPayload, communityServiceStudentLabel, communityServiceViolationLabel, eligibleServiceViolations, headsForDepartment, resolveCommunityServiceStudent, serviceDepartmentOptions } from './lib/communityServiceAdmin.js'
import { createDepartmentReportCsv } from './lib/departmentReports.js'
import { formatUnreadMessageCount, unreadMessageCount } from './lib/messageUnread.js'
import './App.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function App() {
  const [initialSession] = useState(loadSession)
  const [qrScanner, setQrScanner] = useState(null)
  const [isQrScanning, setIsQrScanning] = useState(false)

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
  const [activeView, setActiveView] = useState('Dashboard')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [token, setToken] = useState(initialSession.token)
  const [user, setUser] = useState(initialSession.user)

  const [students, setStudents] = useState([])
  const [violations, setViolations] = useState([])
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
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
  const [notificationActionError, setNotificationActionError] = useState('')
  const [pendingAccountCounts, setPendingAccountCounts] = useState({ students: 0, departments: 0 })
  const [unreadMessages, setUnreadMessages] = useState(0)

  const markNotificationRead = async (notificationId) => {
    setNotificationActionError('')
    try {
      const response = await fetch(`${API_URL}/api/students/me/notifications/${notificationId}/read`, {
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
  const [studentRosterSearch, setStudentRosterSearch] = useState('')
  const [reviewedStudent, setReviewedStudent] = useState(null)
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
    exact_offense: '',
    incident_details: '',
  })
  const [violationTypes, setViolationTypes] = useState([])
  const [editingViolation, setEditingViolation] = useState(null)
  const [violationEditForm, setViolationEditForm] = useState({description:'',reason:''})
  const [violationEditError, setViolationEditError] = useState('')

  const [violationFormError, setViolationFormError] = useState('')
  const [violationFormSuccess, setViolationFormSuccess] = useState('')

  const [communityServiceAssignments, setCommunityServiceAssignments] =
    useState([])
  const [communityServiceDestinations, setCommunityServiceDestinations] = useState([])

  const [communityServiceForm, setCommunityServiceForm] = useState({
    violation_id: '',
    student_id: '',
    student_search: '',
    required_hours: '',
    department_id: '',
    department_head_id: ''
  })

  const [communityServiceFormError, setCommunityServiceFormError] =
    useState('')

  const [communityServiceFormSuccess, setCommunityServiceFormSuccess] =
    useState('')

  const [qrForm, setQrForm] = useState({
    qr_code: '',
    department_id: '',
    notes: '',
    condition: ''
  })

  const [qrError, setQrError] = useState('')
  const [qrResult, setQrResult] = useState(null)
  const [verifiedQr, setVerifiedQr] = useState('')
  const [qrSubmitting, setQrSubmitting] = useState(false)

  const [clearanceRecords, setClearanceRecords] = useState([])

  const [clearanceForm, setClearanceForm] = useState({
    student_id: '',
    academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    semester: '1st Semester',
    status: 'NOT_ELIGIBLE',
    has_active_violation: false,
    has_pending_service: false,
    cleared_by: '',
    cleared_at: '',
    remarks: ''
  })

  const [clearanceFormError, setClearanceFormError] = useState('')
  const [clearanceFormSuccess, setClearanceFormSuccess] = useState('')

  const [reportType, setReportType] = useState('violations')
  const [reportData, setReportData] = useState([])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  const [reportFilters, setReportFilters] = useState({
    status: '',
    student_id: '',
    from_date: '',
    to_date: '',
    sort_by: 'date_desc'
  })

  const isLoggedIn = Boolean(user)

  const navItems = getNavItems(user?.role)

  const userRole = user?.role || null

  const isAdmin =
    userRole === 'ADMIN' ||
    userRole === 'DISCIPLINE_OFFICE'

  const isDepartmentHead =
    userRole === 'DEPARTMENT_HEAD'

  const isStudent =
    userRole === 'STUDENT'

  const routeResolution = resolveRoute(routePath, userRole)
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
        if (response.ok) setUnreadMessages(unreadMessageCount(data.conversations))
      } catch (loadError) {
        if (loadError.name !== 'AbortError') return
      }
    }
    refresh()
    const interval = window.setInterval(refresh, 30000)
    return () => { controller.abort(); window.clearInterval(interval) }
  }, [isLoggedIn, token])

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
      if (!['/login','/student/login','/department/login'].includes(routePath)) navigateTo('/login', { replace: true })
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
      setActiveView(routeResolution.route.view)
    }
  }, [isLoggedIn, routePath, routeResolution.route, routeResolution.status, user, userRole])

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
      return
    }

    const loadDashboardData = async () => {
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
            studentsResponse,
            violationsResponse,
            violationTypesResponse,
            assignmentsResponse,
            clearanceResponse,
            destinationsResponse
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
            })
          ])

          if (
            !studentsResponse.ok ||
            !violationsResponse.ok ||
            !violationTypesResponse.ok ||
            !assignmentsResponse.ok ||
            !clearanceResponse.ok ||
            !destinationsResponse.ok
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
          const [dtrResponse, assignmentsResponse, nonComplianceResponse] = await Promise.all([
            fetch(`${API_URL}/api/reports/dtr`, { headers: authHeaders }),
            fetch(`${API_URL}/api/community-service?limit=100`, { headers: authHeaders }),
            fetch(`${API_URL}/api/reports/non-compliance?sort_by=date`, { headers: authHeaders })
          ])
          const [dtrData, assignmentsData, nonComplianceData] = await Promise.all([
            dtrResponse.json().catch(() => ({})),
            assignmentsResponse.json().catch(() => ({})),
            nonComplianceResponse.json().catch(() => ({}))
          ])

          if (!dtrResponse.ok || !assignmentsResponse.ok || !nonComplianceResponse.ok) throw new Error(dtrData.message || assignmentsData.message || nonComplianceData.message || 'Unable to load department activity')

          setStudents([])
          setViolations([])
          setCommunityServiceAssignments(assignmentsData.assignments || [])
          setClearanceRecords([])
          setDepartmentDtr(dtrData)
          setDepartmentNonCompliance(nonComplianceData)

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
            fetch(`${API_URL}/api/students/me/notifications?limit=100`, { headers: authHeaders }),
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
    user
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
        !violationForm.exact_offense.trim() ||
        !violationForm.incident_details.trim()
      ) {
        throw new Error(
          'Student, classification, exact offense, incident date, and incident details are required.'
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

  const startQrScanner = async () => {
    setQrError('')
    setQrResult(null)

    try {
      const unavailable = cameraUnavailableMessage({
        secureContext: window.isSecureContext,
        hasMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia)
      })
      if (unavailable) throw new Error(unavailable)

      if (qrScanner) {
        return
      }

      const scanner =
        new Html5Qrcode('qr-reader')

      setQrScanner(scanner)
      setIsQrScanning(true)

      await scanner.start(
        { facingMode: 'environment' },

        {
          fps: 15,

          qrbox: scannerQrBox,

          aspectRatio: 1.0
        },

        (decodedText) => {
          setQrForm((current) => ({
            ...current,
            qr_code: decodedText.trim()
          }))

          setVerifiedQr('')
          setQrResult(null)
          setQrError('QR detected. Verify the student before recording attendance.')

          stopQrScanner(scanner)
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
        ['department_id'].includes(name)
          ? Number(value) || ''
          : value
    }))

    if (name === 'qr_code') {
      setVerifiedQr('')
      setQrResult(null)
      setQrError('')
    }
  }

  const handleQrAction = async (action) => {
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
        session: data.session || null
      })
      setVerifiedQr(qrForm.qr_code.trim())
    } catch (qrErrorObject) {
      setQrError(qrErrorObject.message)
    } finally {
      setQrSubmitting(false)
    }
  }

  /*
   * ============================================================
   * CLEARANCE FORM
   * ============================================================
   */

  const handleClearanceFieldChange = (
    event
  ) => {
    const {
      name,
      value,
      type,
      checked
    } = event.target

    setClearanceForm((current) => ({
      ...current,

      [name]:
        type === 'checkbox'
          ? checked
          : value
    }))
  }

  const handleClearanceSubmit = async (
    event
  ) => {
    event.preventDefault()

    setClearanceFormError('')
    setClearanceFormSuccess('')

    try {
      const payload = {
        student_id:
          Number(
            clearanceForm.student_id
          ),

        academic_year:
          String(
            clearanceForm.academic_year
          ).trim(),

        semester:
          clearanceForm.semester,

        remarks:
          clearanceForm.remarks.trim()
      }

      if (
        !payload.student_id ||
        !payload.academic_year ||
        !payload.semester
      ) {
        throw new Error(
          'Student ID, academic year, and semester are required.'
        )
      }

      const response =
        await fetch(
          `${API_URL}/api/clearance`,
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
          'Unable to create clearance record.'
        )
      }

      setClearanceFormSuccess(
        `Clearance record was created for student #${payload.student_id}.`
      )

      setClearanceForm({
        student_id: '',
        academic_year:
          `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        semester: '1st Semester',
        status: 'NOT_ELIGIBLE',
        has_active_violation: false,
        has_pending_service: false,
        cleared_by: '',
        cleared_at: '',
        remarks: ''
      })

      const refreshedClearance =
        await fetch(
          `${API_URL}/api/clearance`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        )

      if (refreshedClearance.ok) {
        const refreshedData =
          await refreshedClearance.json()

        setClearanceRecords(
          refreshedData.clearanceRecords || []
        )
      }
    } catch (clearanceError) {
      setClearanceFormError(
        clearanceError.message
      )
    }
  }

  /*
   * ============================================================
   * APPROVE CLEARANCE
   * ============================================================
   */

  const handleClearanceApprove = async (
    clearanceId
  ) => {
    setClearanceFormError('')
    setClearanceFormSuccess('')

    try {
      const response =
        await fetch(
          `${API_URL}/api/clearance/${clearanceId}/approve`,
          {
            method: 'PUT',

            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        )

      const data =
        await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          'Unable to approve clearance.'
        )
      }

      setClearanceFormSuccess(
        `Clearance #${clearanceId} was approved successfully.`
      )

      const refreshedClearance =
        await fetch(
          `${API_URL}/api/clearance`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        )

      if (refreshedClearance.ok) {
        const refreshedData =
          await refreshedClearance.json()

        setClearanceRecords(
          refreshedData.clearanceRecords || []
        )
      }
    } catch (approvalError) {
      setClearanceFormError(
        approvalError.message
      )
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
    setReportLoading(true)
    setReportError('')

    try {
      const params =
        new URLSearchParams()

      if (reportFilters.status && ['violations', 'community-service', 'clearance'].includes(reportType)) {
        params.append(
          'status',
          reportFilters.status
        )
      }

      if (reportFilters.student_id) {
        params.append(
          'student_id',
          reportFilters.student_id
        )
      }

      if (reportFilters.from_date && ['violations', 'parent-contacts'].includes(reportType)) {
        params.append(
          'from_date',
          reportFilters.from_date
        )
      }

      if (reportFilters.to_date && ['violations', 'parent-contacts'].includes(reportType)) {
        params.append(
          'to_date',
          reportFilters.to_date
        )
      }

      if (reportFilters.sort_by && reportType !== 'dtr' && reportType !== 'non-compliance') {
        params.append(
          'sort_by',
          reportFilters.sort_by
        )
      }

      const response =
        await fetch(
          `${API_URL}/api/reports/${reportType}?${params.toString()}`,
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

  const exportReportCSV = () => {
    if (reportData.length === 0) {
      return
    }

    const csvContent = createDepartmentReportCsv(reportData)

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
          mode={routePath === '/student/login' ? 'student' : routePath === '/department/login' ? 'department' : 'main'}
          onNavigate={navigateTo}
        />
      )
    }

    if (activeView === 'Messages') {
      return <MessagesPage token={token} role={userRole} students={students} onUnreadChange={updateUnreadMessages} />
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

      if (reportType === 'dtr' && reportFilters.from_date) params.append('from', reportFilters.from_date)
      if (reportType === 'dtr' && reportFilters.to_date) params.append('to', reportFilters.to_date)

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
          />
        )
      }

      if (activeView === 'Notifications') {
        return <StudentNotifications notifications={studentNotifications} loading={dashboardLoading} error={notificationActionError || dashboardError} onMarkRead={markNotificationRead} />
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
                <table>
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
                          <td>
                            {
                              record.academic_year
                            }
                          </td>

                          <td>
                            {
                              record.semester
                            }
                          </td>

                          <td>
                            <span className="status-badge">
                              {
                                record.status
                              }
                            </span>
                          </td>

                          <td>
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
                                ? new Date(
                                    record.cleared_at
                                  ).toLocaleString()
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
        />
      )
    }

    if (isDepartmentHead && activeView === 'Non-Compliance') {
      return <DepartmentNonCompliance report={departmentNonCompliance} loading={dashboardLoading || departmentNonComplianceLoading} error={departmentNonComplianceError || dashboardError} sortBy={departmentNonComplianceSort} onSort={loadDepartmentNonCompliance} />
    }

    if (isDepartmentHead && activeView === 'Reports') {
      return <DepartmentReports dtr={departmentDtr} nonCompliance={departmentNonCompliance} loading={dashboardLoading} error={dashboardError} />
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
      return <GoogleRegistrationReview token={token} onPendingCountChange={updatePendingStudentCount} />
    }

    if (isAdmin && activeView === 'Department Accounts') {
      return <DepartmentAccounts token={token} />
    }

    if (userRole === 'ADMIN' && activeView === 'Accounts') {
      return <AdminAccounts token={token} students={students} />
    }

    if (userRole === 'ADMIN' && activeView === 'Departments') {
      return <AdminDepartments token={token} />
    }

    if (userRole === 'ADMIN' && activeView === 'Audit Log') {
      return <AdminAuditLog token={token} />
    }

    if (userRole === 'ADMIN' && activeView === 'Duplicate Review') {
      return <AdminDuplicateReview token={token} />
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
      return (
        <>
          <section className="table-card form-card">
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

            <div className="noncompliance-toolbar">
              <label><span>Search students</span><input type="search" value={studentRosterSearch} onChange={(event)=>setStudentRosterSearch(event.target.value)} placeholder="Student number, name, program, or section"/></label>
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
                      <th>Condition</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleStudents.map(
                      (student) => {
                        const condition = summarizeStudentCondition(student.id, violations)
                        return (
                        <tr
                          key={
                            student.id
                          }
                        >
                          <td>
                            {student.first_name}{' '}
                            {student.last_name}
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
                          <td>{condition.total} total / {condition.open} open</td>
                          <td><span className="status-badge">{condition.condition}</span></td>
                          <td><div className="table-actions"><button type="button" className="secondary-button" onClick={()=>loadReviewedStudentHistory(student)}>View condition</button><button type="button" className="secondary-button" onClick={()=>setGuardianContactStudent(student)}>Guardian contact</button><StudentAccessRemoval token={token} student={student}/></div></td>
                        </tr>
                        )
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {guardianContactStudent && <GuardianContactPanel token={token} student={guardianContactStudent} onClose={() => setGuardianContactStudent(null)} />}

          {reviewedStudent && reviewedCondition && (
            <section className="table-card">
              <div className="table-header"><div><h3>{reviewedStudent.student_number} - {reviewedStudent.first_name} {reviewedStudent.last_name}</h3><span>{reviewedStudentSummary?.condition || reviewedCondition.condition}</span></div><button type="button" className="secondary-button" onClick={()=>setReviewedStudent(null)}>Close</button></div>
              <section className="stats-grid department-stats" aria-label="Student violation condition"><article className="stat-card"><span>Total violations</span><strong>{reviewedStudentSummary?.total ?? reviewedCondition.total}</strong></article><article className="stat-card"><span>Open violations</span><strong>{reviewedStudentSummary?.open ?? reviewedCondition.open}</strong></article><article className="stat-card"><span>Resolved violations</span><strong>{reviewedStudentSummary?.resolved ?? reviewedCondition.resolved}</strong></article><article className="stat-card"><span>Remaining service</span><strong>{Number(reviewedStudentSummary?.remainingHours ?? reviewedCondition.remainingHours).toFixed(2)} hrs</strong></article></section>
              {sanctionGuidance.length>0&&<section className="registration-review-list" aria-label="Handbook sanction guidance"><div className="table-header"><div><h3>Handbook sanction reference</h3><span>Verify the offense sequence and case circumstances before deciding</span></div></div>{sanctionGuidance.map((item)=><article key={item.code}><div className="registration-review-heading"><div><h4>{item.name}</h4><p>{item.count} recorded offense{item.count===1?'':'s'} in this classification</p></div></div><p><strong>Handbook reference:</strong> {item.guidance}</p></article>)}</section>}
              {reviewedStudentError&&<p className="error-message" role="alert">{reviewedStudentError}</p>}
              {reviewedStudentLoading&&reviewedCondition.records.length===0?<p className="empty-state">Loading violation history...</p>:reviewedCondition.records.length===0?<p className="empty-state">No violation history for this student.</p>:<div className="registration-review-list">{reviewedCondition.records.map((violation)=><article key={violation.id}><div className="registration-review-heading"><div><h4>{violation.violation_name || `Violation #${violation.id}`}</h4><p>{violation.incident_date || 'Incident date unavailable'} · {violation.severity || 'Severity unavailable'}</p></div><span className="status-badge">{violation.status}</span></div><p>{violation.description || 'No incident details recorded.'}</p><dl><div><dt>Required service</dt><dd>{Number(violation.required_service_hours||0).toFixed(2)} hrs</dd></div><div><dt>Completed service</dt><dd>{Number(violation.completed_service_hours||0).toFixed(2)} hrs</dd></div></dl></article>)}</div>}
              {reviewedStudentHasMore&&<button type="button" className="secondary-button" disabled={reviewedStudentLoading} onClick={()=>loadReviewedStudentHistory(reviewedStudent,reviewedStudentPage+1,true)}>{reviewedStudentLoading?'Loading...':'Load older violations'}</button>}
              <p className="form-guidance">Use the documented category, repeat-offense history, case facts, and handbook procedure when deciding sanctions. The portal does not assign punishment automatically.</p>
            </section>
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
      return (
        <>
          <section className="table-card form-card">
            <div className="table-header">
              <h3>
                Add violation
              </h3>

              <span>
                New record
              </span>
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
          </section>

          {editingViolation && (
            <section className="table-card form-card">
              <div className="table-header"><h3>Edit violation #{editingViolation.id}</h3><span>Open cases only</span></div>
              <form className="student-form" onSubmit={handleViolationUpdate}>
                <div className="student-form-grid">
                  <label className="full-width-field">Violation and incident details<textarea rows="5" value={violationEditForm.description} onChange={(event)=>setViolationEditForm({...violationEditForm,description:event.target.value})} required/></label>
                  <label className="full-width-field">Reason for change<textarea rows="3" value={violationEditForm.reason} onChange={(event)=>setViolationEditForm({...violationEditForm,reason:event.target.value})} placeholder="Explain why this record is being updated" required/></label>
                </div>
                {violationEditError && <p className="error-message" role="alert">{violationEditError}</p>}
                <div className="registration-review-actions"><button type="submit">Save audited changes</button><button type="button" className="secondary-button" onClick={()=>setEditingViolation(null)}>Cancel</button></div>
              </form>
            </section>
          )}

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

                      <th>
                        Status
                      </th>

                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {violations
                      .slice(0, 10)
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
                              {
                                violation.student_id
                              }
                            </td>

                            <td>
                              <span className="status-badge">
                                {
                                  violation.status
                                }
                              </span>
                            </td>

                            <td>{violation.status === 'OPEN' ? <button type="button" className="secondary-button" onClick={()=>startViolationEdit(violation)}>Edit</button> : 'Locked'}</td>
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
      return (
        <>
          <ServiceResultReview token={token} />
          <section className="table-card form-card">
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
                  Required Hours

                  <input
                    type="number"
                    name="required_hours"
                    value={
                      communityServiceForm.required_hours
                    }
                    onChange={
                      handleCommunityServiceFieldChange
                    }
                    min="0.5"
                    step="0.5"
                    required
                  />
                </label>

                <label>
                  Service department
                  <select name="department_id" value={communityServiceForm.department_id} onChange={handleCommunityServiceFieldChange} required>
                    <option value="">Select a department</option>
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
          </section>

          <section className="table-card">
            <div className="table-header">
              <h3>
                Community service tracking
              </h3>

              <span>
                {
                  communityServiceAssignments.length
                }{' '}
                assignments
              </span>
            </div>

            {communityServiceAssignments.length === 0 ? (
              <p className="empty-state">
                No community service
                assignments yet.
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

                      <th>
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {communityServiceAssignments.map(
                      (assignment) => (
                        <tr
                          key={
                            assignment.id
                          }
                        >
                          <td>
                            #{assignment.id}
                          </td>

                          <td>
                            <strong>{assignment.student_number || `Student #${assignment.student_id}`}</strong>
                            {(assignment.first_name || assignment.last_name) && (
                              <span className="table-cell-detail">{assignment.first_name} {assignment.last_name}</span>
                            )}
                          </td>


                          <td>
                            {
                              `#${assignment.violation_id}`
                            }
                          </td>

                          <td>{assignment.department_name || 'Historical assignment'}</td>

                          <td>{assignment.department_head_first_name || assignment.department_head_last_name ? `${assignment.department_head_first_name || ''} ${assignment.department_head_last_name || ''}`.trim() : 'Not recorded'}</td>

                          <td>
                            {
                              assignment.required_hours ||
                              0
                            }
                          </td>

                          <td>
                            {
                              assignment.remaining_hours ??
                              assignment.required_hours ??
                              0
                            }
                          </td>

                          <td>
                            <span className="status-badge">
                              {
                                assignment.status ||
                                'OPEN'
                              }
                            </span>
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
     * ==========================================================
     * QR SCAN
     * ==========================================================
     */

    if (
      activeView === 'QR Scan'
    ) {
      if (isDepartmentHead) {
        return (
          <DepartmentQrScanner
            form={qrForm}
            result={qrResult}
            error={qrError}
            verifiedQr={verifiedQr}
            isScanning={isQrScanning}
            isSubmitting={qrSubmitting}
            onFieldChange={handleQrFieldChange}
            onStartCamera={startQrScanner}
            onStopCamera={() => stopQrScanner()}
            onAction={handleQrAction}
          />
        )
      }

      const scannerDepartments = serviceDepartmentOptions(communityServiceDestinations)

      return (
        <section className="table-card qr-panel">
          <div className="table-header">
            <h3>
              QR attendance
            </h3>

            <span>
              Live scan
            </span>
          </div>

          <div className="qr-camera-section">
            <div id="qr-reader"></div>

            <div className="qr-camera-actions">
              {!isQrScanning ? (
                <button
                  type="button"
                  onClick={
                    startQrScanner
                  }
                >
                  📷 Start Camera Scanner
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    stopQrScanner()
                  }
                >
                  Stop Camera
                </button>
              )}
            </div>
          </div>

          <div className="student-form-grid qr-grid">
            <label>
              QR Code

              <input
                type="text"
                name="qr_code"
                value={
                  qrForm.qr_code
                }
                onChange={
                  handleQrFieldChange
                }
                placeholder="STI-2026-001"
              />
            </label>

            <label>
              Scanned By

              <input
                type="text"
                value={user?.username || 'Authenticated staff'}
                readOnly
                aria-readonly="true"
              />
              <span>Recorded automatically from the signed-in account for audit accuracy.</span>
            </label>

            <label>
              Department

              <select
                name="department_id"
                value={
                  qrForm.department_id
                }
                onChange={
                  handleQrFieldChange
                }
                required
              >
                <option value="">Select the assigned department</option>
                {scannerDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}{department.code ? ` (${department.code})` : ''}
                  </option>
                ))}
              </select>
              <span>Need another destination? Configure an active “Other” department and Department Head first.</span>
            </label>

            <label className="full-width-field">
              Notes

              <input
                type="text"
                name="notes"
                value={
                  qrForm.notes
                }
                onChange={
                  handleQrFieldChange
                }
                placeholder="Optional attendance note"
              />
            </label>
            <label className="full-width-field">Student service condition
              <select name="condition" value={qrForm.condition} onChange={handleQrFieldChange}>
                <option value="">Select before time-out</option>
                <option value="SATISFACTORY">Satisfactory</option>
                <option value="NEEDS_FOLLOW_UP">Needs follow-up</option>
                <option value="INCIDENT_REPORTED">Incident reported</option>
              </select>
            </label>
          </div>

          <div className="qr-actions">
            <button
              type="button"
              onClick={() =>
                handleQrAction('scan')
              }
            >
              Scan Student
            </button>

            <button
              type="button"
              className="secondary"
              onClick={() =>
                handleQrAction('time-in')
              }
            >
              Time In
            </button>

            <button
              type="button"
              className="secondary"
              disabled={!qrForm.condition}
              onClick={() =>
                handleQrAction('time-out')
              }
            >
              Time Out
            </button>
          </div>

          {qrError && (
            <p className="error-message">
              {qrError}
            </p>
          )}

          {qrResult && (
            <div className="qr-result">
              <strong>
                {qrResult.action.replace(
                  '-',
                  ' '
                )}
              </strong>

              <p>
                {qrResult.message}
              </p>

              {qrResult.student && (
                <span>
                  Student:{' '}
                  {
                    qrResult.student.first_name
                  }{' '}
                  {
                    qrResult.student.last_name
                  }{' '}
                  (
                  {
                    qrResult.student.student_number
                  }
                  )
                </span>
              )}

              {qrResult.studentId && (
                <span>
                  Student ID:{' '}
                  {qrResult.studentId}
                </span>
              )}

              {qrResult.notes && (
                <span>
                  Notes:{' '}
                  {qrResult.notes}
                </span>
              )}
            </div>
          )}
        </section>
      )
    }

    /*
     * ==========================================================
     * CLEARANCE
     * ==========================================================
     */

    if (
      activeView === 'Clearance'
    ) {
      return (
        <>
          {isAdmin && (
            <section className="table-card form-card">
              <div className="table-header">
                <h3>
                  Clearance Record
                </h3>

                <span>
                  New record
                </span>
              </div>

              <form
                className="student-form"
                onSubmit={
                  handleClearanceSubmit
                }
              >
                <div className="student-form-grid">
                  <label>
                    Student ID

                    <input
                      type="number"
                      name="student_id"
                      value={
                        clearanceForm.student_id
                      }
                      onChange={
                        handleClearanceFieldChange
                      }
                      min="1"
                      required
                    />
                  </label>

                  <label>
                    Academic Year

                    <input
                      type="text"
                      name="academic_year"
                      value={
                        clearanceForm.academic_year
                      }
                      onChange={
                        handleClearanceFieldChange
                      }
                      placeholder="2025-2026"
                      required
                    />
                  </label>

                  <label>
                    Semester

                    <select
                      name="semester"
                      value={
                        clearanceForm.semester
                      }
                      onChange={
                        handleClearanceFieldChange
                      }
                    >
                      <option value="1st Semester">
                        1st Semester
                      </option>

                      <option value="2nd Semester">
                        2nd Semester
                      </option>

                      <option value="Summer">
                        Summer
                      </option>
                    </select>
                  </label>

                  <label className="full-width-field">
                    Remarks

                    <textarea
                      name="remarks"
                      value={
                        clearanceForm.remarks
                      }
                      onChange={
                        handleClearanceFieldChange
                      }
                      rows="3"
                      placeholder="Add clearance notes"
                    />
                  </label>
                </div>

                {clearanceFormError && (
                  <p className="error-message">
                    {
                      clearanceFormError
                    }
                  </p>
                )}

                {clearanceFormSuccess && (
                  <p className="success-message">
                    {
                      clearanceFormSuccess
                    }
                  </p>
                )}

                <button
                  type="submit"
                  className="submit-btn"
                >
                  Create Clearance
                </button>
              </form>
            </section>
          )}

          <section className="table-card">
            <div className="table-header">
              <h3>
                Clearance Records
              </h3>

              <span>
                {
                  clearanceRecords.length
                }{' '}
                records
              </span>
            </div>

            {clearanceRecords.length === 0 ? (
              <p className="empty-state">
                No clearance records yet.
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
                        Action
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
                          <td>
                            #{record.id}
                          </td>

                          <td>
                            {record.first_name ||
                            record.last_name
                              ? `${record.first_name || ''} ${record.last_name || ''}`.trim()
                              : `Student #${record.student_id}`}
                          </td>

                          <td>
                            {
                              record.academic_year
                            }
                          </td>

                          <td>
                            {
                              record.semester
                            }
                          </td>

                          <td>
                            <span className="status-badge">
                              {
                                record.status
                              }
                            </span>
                          </td>

                          <td>
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
                            {isDepartmentHead &&
                            record.status ===
                              'PENDING' &&
                            !record.has_active_violation &&
                            !record.has_pending_service ? (
                              <button
                                type="button"
                                className="submit-btn"
                                onClick={() =>
                                  handleClearanceApprove(
                                    record.id
                                  )
                                }
                              >
                                Approve
                              </button>
                            ) : (
                              <span>
                                —
                              </span>
                            )}
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
     * ==========================================================
     * REPORTS
     * ==========================================================
     */

    if (
      activeView === 'Reports'
    ) {
      return (
        <>
          <section className="table-card form-card">
            <div className="table-header">
              <h3>
                Generate Report
              </h3>

              <span>
                Filter and export
              </span>
            </div>

            {reportError && <p className="error-message" role="alert">{reportError}</p>}

            <div
              className="student-form-grid"
              style={{
                marginBottom: '16px'
              }}
            >
              <label>
                Report Type

                <select
                  value={reportType}
                  onChange={(event) => {
                    setReportType(
                      event.target.value
                    )

                    setReportData([])
                    setReportFilters((current) => ({ ...current, status: '', from_date: '', to_date: '', sort_by: event.target.value === 'good-standing' ? 'student_number' : 'date_desc' }))
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
                  <option value="parent-contacts">Parent Contact Report</option>
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
                  <option value="date_desc">
                    Date (Newest First)
                  </option>

                  <option value="date_asc">
                    Date (Oldest First)
                  </option>

                  <option value="status">
                    Status
                  </option>
                  <option value="student_number">Student Number</option>
                  <option value="name">Student Name</option>
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

            <div
              style={{
                display: 'flex',
                gap: '10px'
              }}
            >
              <button
                className="submit-btn"
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
                  reportData.length === 0
                }
                style={{
                  background: '#059669'
                }}
              >
                Export CSV
              </button>
            </div>
          </section>

          <section className="table-card">
            <div className="table-header">
              <h3>
                Report Results
              </h3>

              <span>
                {reportData.length}{' '}
                records
              </span>
            </div>

            {reportData.length === 0 ? (
              <p className="empty-state">
                No data to display.
                Generate a report to see
                results.
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
                            {key
                              .replace(
                                /_/g,
                                ' '
                              )
                              .toUpperCase()}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {reportData
                      .slice(0, 50)
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
                                  {typeof value ===
                                  'boolean'
                                    ? value
                                      ? 'Yes'
                                      : 'No'
                                    : value}
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
          </section>
        </>
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
                          {
                            student.first_name
                          }{' '}
                          {
                            student.last_name
                          }
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

                    <th>
                      Status
                    </th>

                    <th>
                      Hours
                    </th>
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
                            {
                              violation.student_id
                            }
                          </td>

                          <td>
                            <span className="status-badge">
                              {
                                violation.status
                              }
                            </span>
                          </td>

                          <td>
                            {
                              violation.required_service_hours ||
                              0
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
      </>
    )
  }

  /*
   * ============================================================
   * MAIN APPLICATION LAYOUT
   * ============================================================
   */

  return (
    <div className={`app-shell ${!isLoggedIn ? 'auth-shell' : ''}`}>
      {isLoggedIn && <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            S
          </div>

          <div>
            <h2>
              STI Vio-Log
            </h2>

            <small>
              Discipline Portal
            </small>
          </div>
        </div>

        <nav className="nav">
          {navItems.map(
            (item) => (
              <button
                key={item.path}
                className={`nav-item ${
                  routePath === item.path
                    ? 'active'
                    : ''
                }`}
                onClick={() => {
                  if (isQrScanning && item.view !== 'QR Scan') stopQrScanner()
                  navigateTo(item.path)
                }}
                type="button"
                aria-current={routePath === item.path ? 'page' : undefined}
              >
                <span>{item.label}</span>
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
            )
          )}
        </nav>
      </aside>}

      <main className="main-panel">
        {isLoggedIn && <header className="topbar">
          <div>
            <p className="eyebrow">
              {isStudent
                ? 'Student Portal'
                : isDepartmentHead
                  ? 'Department Head'
                  : 'Administration'}
            </p>

            <h1>
              {routeResolution.route?.label || 'Portal'}
            </h1>
          </div>

          {isLoggedIn && (
            <div className="account-actions">
              <div className="account-summary">
                <strong>{user?.username}</strong>
                <span>{userRole?.replaceAll('_', ' ')}</span>
              </div>
              <button
                className="logout-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          )}
        </header>}

        {renderContent()}
      </main>
    </div>
  )
}

export default App
