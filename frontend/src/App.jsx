import { useEffect, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import LoginPage from './components/LoginPage.jsx'
import RouteStatePage from './components/RouteStatePage.jsx'
import StudentDashboard from './components/StudentDashboard.jsx'
import StudentProfile from './components/StudentProfile.jsx'
import StudentQr from './components/StudentQr.jsx'
import StudentViolations from './components/StudentViolations.jsx'
import { API_URL, login } from './lib/api.js'
import { getHomePath, getNavItems, resolveRoute } from './lib/routes.js'
import { clearSession, loadSession, saveSession } from './lib/session.js'
import './App.css'

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

  const [studentForm, setStudentForm] = useState({
    user_id: 1,
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

  const [violationForm, setViolationForm] = useState({
    student_id: '',
    violation_type_id: '',
    reported_by: 1,
    incident_date: '',
    description: '',
    status: 'OPEN',
    required_service_hours: 0,
    completed_service_hours: 0,
    cleared_at: ''
  })

  const [violationFormError, setViolationFormError] = useState('')
  const [violationFormSuccess, setViolationFormSuccess] = useState('')

  const [communityServiceAssignments, setCommunityServiceAssignments] =
    useState([])

  const [communityServiceForm, setCommunityServiceForm] = useState({
    violation_id: '',
    student_id: '',
    required_hours: 0,
    completed_hours: 0,
    remaining_hours: 0,
    status: 'OPEN',
    completed_at: ''
  })

  const [communityServiceFormError, setCommunityServiceFormError] =
    useState('')

  const [communityServiceFormSuccess, setCommunityServiceFormSuccess] =
    useState('')

  const [qrForm, setQrForm] = useState({
    qr_code: '',
    scanned_by: 1,
    department_id: 1,
    notes: ''
  })

  const [qrError, setQrError] = useState('')
  const [qrResult, setQrResult] = useState(null)

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
      if (routePath !== '/login') navigateTo('/login', { replace: true })
      return
    }

    if (routePath === '/' || routePath === '/login') {
      navigateTo(getHomePath(userRole), { replace: true })
      return
    }

    if (routeResolution.status === 'allowed') {
      setActiveView(routeResolution.route.view)
    }
  }, [isLoggedIn, routePath, routeResolution.route, routeResolution.status, userRole])

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
      setDashboardError('')
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
            assignmentsResponse,
            clearanceResponse
          ] = await Promise.all([
            fetch(`${API_URL}/api/students`, {
              headers: authHeaders
            }),

            fetch(`${API_URL}/api/violations`, {
              headers: authHeaders
            }),

            fetch(`${API_URL}/api/community-service`, {
              headers: authHeaders
            }),

            fetch(`${API_URL}/api/clearance`, {
              headers: authHeaders
            })
          ])

          if (
            !studentsResponse.ok ||
            !violationsResponse.ok ||
            !assignmentsResponse.ok ||
            !clearanceResponse.ok
          ) {
            throw new Error(
              'Unable to load administration data'
            )
          }

          const studentsData =
            await studentsResponse.json()

          const violationsData =
            await violationsResponse.json()

          const assignmentsData =
            await assignmentsResponse.json()

          const clearanceData =
            await clearanceResponse.json()

          setStudents(
            studentsData.students || []
          )

          setViolations(
            violationsData.violations || []
          )

          setCommunityServiceAssignments(
            assignmentsData.assignments || []
          )

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
          const clearanceResponse =
            await fetch(
              `${API_URL}/api/clearance`,
              {
                headers: authHeaders
              }
            )

          if (!clearanceResponse.ok) {
            const errorData =
              await clearanceResponse
                .json()
                .catch(() => ({}))

            throw new Error(
              errorData.message ||
              'Unable to load clearance records'
            )
          }

          const clearanceData =
            await clearanceResponse.json()

          setStudents([])
          setViolations([])
          setCommunityServiceAssignments([])

          setClearanceRecords(
            clearanceData.clearanceRecords || []
          )

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
            fetch(`${API_URL}/api/student/clearance`, { headers: authHeaders }),
            fetch(`${API_URL}/api/student/clearance/eligibility`, { headers: authHeaders })
          ])

          const payloads = await Promise.all(responses.map((response) => response.json().catch(() => ({}))))
          const failedIndex = responses.findIndex((response) => !response.ok)

          if (failedIndex !== -1) {
            throw new Error(payloads[failedIndex].message || 'Unable to load your dashboard')
          }

          const [profileData, violationsData, assignmentsData, clearanceData, eligibilityData] = payloads
          setStudentProfile(profileData.student || null)
          setViolations(violationsData.violations || [])
          setCommunityServiceAssignments(assignmentsData.assignments || [])
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
        setDashboardError(fetchError.message || 'Unable to load dashboard data')
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
        name === 'user_id' ||
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

    setViolationForm((current) => ({
      ...current,
      [name]:
        [
          'student_id',
          'violation_type_id',
          'reported_by',
          'required_service_hours',
          'completed_service_hours'
        ].includes(name)
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

    setCommunityServiceForm((current) => ({
      ...current,
      [name]:
        [
          'violation_id',
          'student_id',
          'required_hours',
          'completed_hours',
          'remaining_hours'
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
        !payload.user_id ||
        !payload.student_number ||
        !payload.first_name ||
        !payload.last_name
      ) {
        throw new Error(
          'User ID, student number, first name, and last name are required.'
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
        user_id: 1,
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
      const payload = {
        ...violationForm,

        student_id:
          Number(violationForm.student_id),

        violation_type_id:
          Number(violationForm.violation_type_id),

        reported_by:
          Number(violationForm.reported_by),

        required_service_hours:
          Number(
            violationForm.required_service_hours || 0
          ),

        completed_service_hours:
          Number(
            violationForm.completed_service_hours || 0
          ),

        incident_date:
          violationForm.incident_date ||
          new Date()
            .toISOString()
            .slice(0, 10),

        description:
          violationForm.description.trim(),

        cleared_at:
          violationForm.cleared_at || null
      }

      if (
        !payload.student_id ||
        !payload.violation_type_id ||
        !payload.incident_date
      ) {
        throw new Error(
          'Student, violation type, and incident date are required.'
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
        violation_type_id: '',
        reported_by: 1,
        incident_date: '',
        description: '',
        status: 'OPEN',
        required_service_hours: 0,
        completed_service_hours: 0,
        cleared_at: ''
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
        const payload = {
          ...communityServiceForm,

          violation_id:
            Number(
              communityServiceForm.violation_id
            ),

          student_id:
            Number(
              communityServiceForm.student_id
            ),

          required_hours:
            Number(
              communityServiceForm.required_hours || 0
            ),

          completed_hours:
            Number(
              communityServiceForm.completed_hours || 0
            ),

          remaining_hours:
            Number(
              communityServiceForm.remaining_hours ||
              communityServiceForm.required_hours ||
              0
            ),

          completed_at:
            communityServiceForm.completed_at ||
            null
        }

        if (
          !payload.violation_id ||
          !payload.student_id ||
          !payload.required_hours
        ) {
          throw new Error(
            'Violation ID, student ID, and required hours are required.'
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
          `Assignment for student #${payload.student_id} was created.`
        )

        setCommunityServiceForm({
          violation_id: '',
          student_id: '',
          required_hours: 0,
          completed_hours: 0,
          remaining_hours: 0,
          status: 'OPEN',
          completed_at: ''
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

          qrbox: {
            width: 280,
            height: 280
          },

          aspectRatio: 1.0
        },

        (decodedText) => {
          setQrForm((current) => ({
            ...current,
            qr_code: decodedText.trim()
          }))

          setQrResult({
            action: 'scan',
            message:
              `QR code detected: ${decodedText}`,
            student: null,
            studentId: null,
            notes: null
          })

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
        ['scanned_by', 'department_id'].includes(name)
          ? Number(value) || ''
          : value
    }))
  }

  const handleQrAction = async (action) => {
    setQrError('')
    setQrResult(null)

    try {
      if (!qrForm.qr_code.trim()) {
        throw new Error(
          'QR code is required.'
        )
      }

      const response =
        await fetch(
          `${API_URL}/api/qr/${action}`,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },

            body: JSON.stringify({
              qr_code:
                qrForm.qr_code.trim(),

              scanned_by:
                Number(qrForm.scanned_by),

              department_id:
                Number(qrForm.department_id),

              notes:
                qrForm.notes.trim()
            })
          }
        )

      const data =
        await response.json()

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
        notes: data.notes || null
      })
    } catch (qrErrorObject) {
      setQrError(
        qrErrorObject.message
      )
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

      saveSession(data)

      setToken(data.token)
      setUser(data.user)
      navigateTo(getHomePath(data.user.role), { replace: true })

      /*
       * Clear the password from React state
       * after successful login.
       */

      setForm({
        username: '',
        password: ''
      })
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

    try {
      const params =
        new URLSearchParams()

      if (reportFilters.status) {
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

      if (reportFilters.from_date) {
        params.append(
          'from_date',
          reportFilters.from_date
        )
      }

      if (reportFilters.to_date) {
        params.append(
          'to_date',
          reportFilters.to_date
        )
      }

      if (reportFilters.sort_by) {
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
      }
    } catch (error) {
      console.error(
        'Report fetch error:',
        error
      )

      setReportData([])
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

    const headers =
      Object.keys(
        reportData[0]
      )

    const csvContent = [
      headers.join(','),

      ...reportData.map(
        (row) =>
          headers
            .map((header) => {
              const value =
                row[header]

              if (
                typeof value === 'string'
              ) {
                const escaped =
                  value.replace(
                    /"/g,
                    '""'
                  )

                return `"${escaped}"`
              }

              return value ?? ''
            })
            .join(',')
      )
    ].join('\n')

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
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
      )
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

      if (
        activeView === 'My Clearance'
      ) {
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
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <span>
                Role
              </span>

              <strong>
                Department Head
              </strong>
            </article>

            <article className="stat-card">
              <span>
                QR Scanner
              </span>

              <strong>
                Ready
              </strong>
            </article>
          </section>

          <section className="table-card qr-panel">
            <div className="table-header">
              <h3>
                QR Scanner Status
              </h3>

              <span>
                Time tracking
              </span>
            </div>

            <p
              style={{
                margin: 0,
                color: '#32415d'
              }}
            >
              Use the QR Scan menu item to
              scan student QR codes and
              record time-in/time-out.
            </p>
          </section>
        </>
      )
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
                  User ID

                  <input
                    type="number"
                    name="user_id"
                    value={
                      studentForm.user_id
                    }
                    onChange={
                      handleStudentFieldChange
                    }
                    min="1"
                  />
                </label>

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
                    placeholder="2024-001"
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
                    placeholder="BSIT-3A"
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
     * VIOLATIONS
     * ==========================================================
     */

    if (
      activeView === 'Violations'
    ) {
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
                  Student ID

                  <input
                    type="number"
                    name="student_id"
                    value={
                      violationForm.student_id
                    }
                    onChange={
                      handleViolationFieldChange
                    }
                    min="1"
                  />
                </label>

                <label>
                  Violation Type ID

                  <input
                    type="number"
                    name="violation_type_id"
                    value={
                      violationForm.violation_type_id
                    }
                    onChange={
                      handleViolationFieldChange
                    }
                    min="1"
                  />
                </label>

                <label>
                  Reported By

                  <input
                    type="number"
                    name="reported_by"
                    value={
                      violationForm.reported_by
                    }
                    onChange={
                      handleViolationFieldChange
                    }
                    min="1"
                  />
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
                  Status

                  <select
                    name="status"
                    value={
                      violationForm.status
                    }
                    onChange={
                      handleViolationFieldChange
                    }
                  >
                    <option value="OPEN">
                      OPEN
                    </option>

                    <option value="IN_PROGRESS">
                      IN_PROGRESS
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
                  Required Hours

                  <input
                    type="number"
                    name="required_service_hours"
                    value={
                      violationForm.required_service_hours
                    }
                    onChange={
                      handleViolationFieldChange
                    }
                    min="0"
                    step="0.5"
                  />
                </label>

                <label>
                  Completed Hours

                  <input
                    type="number"
                    name="completed_service_hours"
                    value={
                      violationForm.completed_service_hours
                    }
                    onChange={
                      handleViolationFieldChange
                    }
                    min="0"
                    step="0.5"
                  />
                </label>

                <label>
                  Cleared At

                  <input
                    type="date"
                    name="cleared_at"
                    value={
                      violationForm.cleared_at
                    }
                    onChange={
                      handleViolationFieldChange
                    }
                  />
                </label>

                <label className="full-width-field">
                  Description

                  <textarea
                    name="description"
                    value={
                      violationForm.description
                    }
                    onChange={
                      handleViolationFieldChange
                    }
                    rows="4"
                    placeholder="Describe the incident"
                  />
                </label>
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
     * ==========================================================
     * COMMUNITY SERVICE
     * ==========================================================
     */

    if (
      activeView === 'Community Service'
    ) {
      return (
        <>
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
                  Violation ID

                  <input
                    type="number"
                    name="violation_id"
                    value={
                      communityServiceForm.violation_id
                    }
                    onChange={
                      handleCommunityServiceFieldChange
                    }
                    min="1"
                  />
                </label>

                <label>
                  Student ID

                  <input
                    type="number"
                    name="student_id"
                    value={
                      communityServiceForm.student_id
                    }
                    onChange={
                      handleCommunityServiceFieldChange
                    }
                    min="1"
                  />
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
                    min="0"
                    step="0.5"
                  />
                </label>

                <label>
                  Completed Hours

                  <input
                    type="number"
                    name="completed_hours"
                    value={
                      communityServiceForm.completed_hours
                    }
                    onChange={
                      handleCommunityServiceFieldChange
                    }
                    min="0"
                    step="0.5"
                  />
                </label>

                <label>
                  Remaining Hours

                  <input
                    type="number"
                    name="remaining_hours"
                    value={
                      communityServiceForm.remaining_hours
                    }
                    onChange={
                      handleCommunityServiceFieldChange
                    }
                    min="0"
                    step="0.5"
                  />
                </label>

                <label>
                  Status

                  <select
                    name="status"
                    value={
                      communityServiceForm.status
                    }
                    onChange={
                      handleCommunityServiceFieldChange
                    }
                  >
                    <option value="OPEN">
                      OPEN
                    </option>

                    <option value="IN_PROGRESS">
                      IN_PROGRESS
                    </option>

                    <option value="COMPLETED">
                      COMPLETED
                    </option>

                    <option value="CLOSED">
                      CLOSED
                    </option>
                  </select>
                </label>

                <label>
                  Completed At

                  <input
                    type="date"
                    name="completed_at"
                    value={
                      communityServiceForm.completed_at
                    }
                    onChange={
                      handleCommunityServiceFieldChange
                    }
                  />
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
                            {
                              assignment.student_id
                            }
                          </td>

                          <td>
                            {
                              assignment.violation_id
                            }
                          </td>

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
                type="number"
                name="scanned_by"
                value={
                  qrForm.scanned_by
                }
                onChange={
                  handleQrFieldChange
                }
                min="1"
              />
            </label>

            <label>
              Department ID

              <input
                type="number"
                name="department_id"
                value={
                  qrForm.department_id
                }
                onChange={
                  handleQrFieldChange
                }
                min="1"
              />
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
                onClick={() =>
                  navigateTo(item.path)
                }
                type="button"
                aria-current={routePath === item.path ? 'page' : undefined}
              >
                {item.label}
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
