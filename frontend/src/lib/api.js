import { buildGoogleLinkPayload } from './googleIdentity.js'

export const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5000'

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const installMutationRequestGuard = (target = globalThis) => {
  if (!target?.fetch || target.fetch.__stiMutationGuard) return
  const originalFetch = target.fetch.bind(target)
  const inFlight = new Map()
  const activityCounts = new WeakMap()
  let recentTrigger = null
  let triggerTime = 0
  const rememberTrigger = (element) => {
    if (!element) return
    recentTrigger = element
    triggerTime = Date.now()
  }
  target.document?.addEventListener('click', (event) => rememberTrigger(event.target?.closest?.('button')), true)
  target.document?.addEventListener('submit', (event) => rememberTrigger(event.submitter), true)
  const beginActivity = () => {
    const element = Date.now() - triggerTime < 1000 && recentTrigger?.isConnected ? recentTrigger : null
    if (!element) return null
    const current = activityCounts.get(element) || 0
    activityCounts.set(element, current + 1)
    if (!current) {
      element.dataset.mutationWasDisabled = element.disabled ? 'true' : 'false'
      element.disabled = true
      element.classList.add('mutation-in-flight')
      element.setAttribute('aria-busy', 'true')
    }
    return element
  }
  const endActivity = (element) => {
    if (!element?.isConnected) return
    const remaining = Math.max(0, (activityCounts.get(element) || 1) - 1)
    if (remaining) { activityCounts.set(element, remaining); return }
    activityCounts.delete(element)
    element.classList.remove('mutation-in-flight')
    element.removeAttribute('aria-busy')
    if (element.dataset.mutationWasDisabled !== 'true') element.disabled = false
    delete element.dataset.mutationWasDisabled
  }
  const guardedFetch = (input, options = {}) => {
    const method = String(options.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase()
    if (!mutationMethods.has(method)) return originalFetch(input, options)
    const url = typeof input === 'string' ? input : input?.url || String(input)
    const body = typeof options.body === 'string' ? options.body : ''
    const key = `${method}:${url}:${body}`
    const activityElement = beginActivity()
    if (!inFlight.has(key)) {
      const request = originalFetch(input, options)
        .then((response) => response.clone())
        .finally(() => inFlight.delete(key))
      inFlight.set(key, request)
    }
    return inFlight.get(key).then((response) => response.clone()).finally(() => endActivity(activityElement))
  }
  guardedFetch.__stiMutationGuard = true
  target.fetch = guardedFetch
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const readJson = async (response) => {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) return null

  return response.json().catch(() => null)
}

export const apiRequest = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, options)
  const data = await readJson(response)

  if (!response.ok || data?.success === false) {
    throw new ApiError(
      data?.error?.message || data?.message || 'The request could not be completed.',
      {
        status: response.status,
        code: data?.error?.code || 'REQUEST_FAILED'
      }
    )
  }

  return data
}

export const login = (credentials) =>
  apiRequest('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  })

export const googleLogin = (credential) =>
  apiRequest('/api/auth/google/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  })

export const googleLink = (registration) =>
  apiRequest('/api/auth/google/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGoogleLinkPayload(registration))
  })

export const googleDepartmentLogin = (credential) =>
  apiRequest('/api/auth/google/department/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  })

export const googleDepartmentRegister = ({ credential, firstName, lastName, employeeNumber, departmentType, departmentName, note }) =>
  apiRequest('/api/auth/google/department/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential, first_name: firstName, last_name: lastName, employee_number: employeeNumber || undefined,
      department_type: departmentType, department_name: departmentName, note: note || undefined })
  })

export const changePassword = ({ token, currentPassword, newPassword }) =>
  apiRequest('/api/account/password-change', {
    method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:JSON.stringify({current_password:currentPassword,new_password:newPassword})
  })
