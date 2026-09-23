import { buildGoogleLinkPayload } from './googleIdentity.js'
import { clearSession, csrfToken, saveCsrf } from './session.js'

// Production requests stay on the Vercel origin and are securely proxied to the
// Render API. This keeps host-only SameSite=Lax cookies first-party.
export const API_URL = import.meta.env?.PROD ? '' : (import.meta.env?.VITE_API_URL || 'http://localhost:5000')

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const apiPath = (url, target = globalThis) => {
  try {
    return new URL(String(url), target.location?.origin || 'http://localhost').pathname
  } catch {
    return ''
  }
}

const isPublicAuthPath = (pathname) => /^\/api\/(?:login\/?$|auth\/(?:google|student|mfa)(?:\/|$))/.test(pathname)

export const installMutationRequestGuard = (target = globalThis) => {
  if (!target?.fetch || target.fetch.__stiMutationGuard) return
  const originalFetch = target.fetch.bind(target)
  const inFlight = new Map()
  const activityCounts = new WeakMap()
  let sessionExpiryHandled = false
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
  const guardedFetch = async (input, options = {}) => {
    const method = String(options.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase()
    const url = typeof input === 'string' ? input : input?.url || String(input)
    const headers=new Headers(options.headers||(typeof input!=='string'&&input?.headers)||{})
    headers.delete('Authorization')
    const securedOptions={...options,headers,credentials:'include'}
    const isMutation=mutationMethods.has(method)
    const pathname = apiPath(url, target)
    const publicAuth = isPublicAuthPath(pathname)
    const protectedApi = pathname.startsWith('/api/')
    const handleProtectedResponse = (response) => {
      if (response.status !== 401 || !protectedApi || publicAuth || sessionExpiryHandled) return response
      sessionExpiryHandled = true
      clearSession()
      const EventConstructor = target.CustomEvent || globalThis.CustomEvent
      if (target.dispatchEvent && EventConstructor) target.dispatchEvent(new EventConstructor('sti:session-expired'))
      if (target.location?.pathname !== '/login') target.location?.replace?.('/login')
      return response
    }
    if(isMutation&&protectedApi&&!publicAuth){let csrf=csrfToken();if(!csrf){const response=await originalFetch(`${API_URL}/api/auth/csrf`,{credentials:'include',headers:{Accept:'application/json'}});const data=await response.json().catch(()=>null);if(response.ok&&data?.csrf_token){saveCsrf(data.csrf_token);csrf=data.csrf_token}}if(csrf)headers.set('X-CSRF-Token',csrf)}
    if (!isMutation) return originalFetch(input, securedOptions).then(handleProtectedResponse)
    const body = typeof options.body === 'string' ? options.body : ''
    const key = `${method}:${url}:${body}`
    const activityElement = beginActivity()
    if (!inFlight.has(key)) {
      const request = originalFetch(input, securedOptions)
        .then(handleProtectedResponse)
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
  if(data?.csrf_token)saveCsrf(data.csrf_token)

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

export const loadAllPages = async (path, collectionKey, options = {}) => {
  const { limit = 100, ...requestOptions } = options
  const url = new URL(path, 'http://local.invalid')
  const records = []
  let page = 1

  while (true) {
    url.searchParams.set('page', String(page))
    url.searchParams.set('limit', String(limit))
    const requestPath = `${url.pathname}${url.search}`
    const data = await apiRequest(requestPath, requestOptions)
    const batch = data?.[collectionKey]
    if (!Array.isArray(batch)) throw new ApiError(`Invalid ${collectionKey} response.`, { code: 'INVALID_RESPONSE' })
    records.push(...batch)
    if (batch.length < limit) return records
    page += 1
  }
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

export const changePassword = ({ token, currentPassword, newPassword }) =>
  apiRequest('/api/account/password-change', {
    method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:JSON.stringify({current_password:currentPassword,new_password:newPassword})
  })

export const linkStudentGoogle = (credential) =>
  apiRequest('/api/account/student-onboarding/google-link', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({credential})
  })

export const completeStudentOnboarding = (profile) =>
  apiRequest('/api/account/student-onboarding/profile', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(profile)
  })
