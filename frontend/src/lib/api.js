import { buildGoogleLinkPayload } from './googleIdentity.js'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

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
