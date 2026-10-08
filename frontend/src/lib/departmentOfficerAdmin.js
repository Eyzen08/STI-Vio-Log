import { capitalizeWords } from './inputNormalization.js'

export const OFFICER_ROLES = ['DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD']

const namePattern = String.raw`\p{L}[\p{L}\p{M}]*(?:\.?(?: +|['’\-])\p{L}[\p{L}\p{M}]*)*\.?`
export const OFFICER_FIELD_PATTERNS = {
  firstName: namePattern,
  lastName: namePattern,
  departmentType: String.raw`\p{L}[\p{L}\p{M}]*(?:\.?(?: +|['’\-]| *& *)\p{L}[\p{L}\p{M}]*)*\.?`,
  username: String.raw`[a-zA-Z0-9][a-zA-Z0-9._\-]*`,
  employeeNumber: String.raw`[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*`
}

export const normalizeOfficerField = (field, value) => {
  const input = String(value ?? '').normalize('NFKC')
  if (field === 'firstName' || field === 'lastName') return capitalizeWords(input.replace(/[^\p{L}\p{M} .'’-]/gu, ''))
  if (field === 'departmentType') return capitalizeWords(input.replace(/[^\p{L}\p{M} .'’&-]/gu, ''))
  if (field === 'username') return input.toLowerCase().replace(/[^a-z0-9._-]/g, '')
  if (field === 'employeeNumber') return input.replace(/[^a-zA-Z0-9-]/g, '').replace(/-+/g, '-')
  return value
}

const text = (value) => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ')

export const buildDepartmentOfficerPayload = (form = {}) => ({
  department_name: text(form.departmentType),
  description: text(form.description) || undefined,
  department_status: 'active',
  username: text(form.username).toLowerCase(),
  role: String(form.role || '').toUpperCase(),
  first_name: text(form.firstName),
  last_name: text(form.lastName),
  employee_number: text(form.employeeNumber) || undefined,
  email: text(form.email).toLowerCase() || undefined
})

export const officerFormValid = (form) => {
  const fields = { departmentType: 150, firstName: 100, lastName: 100, username: 100, employeeNumber: 50 }
  return Object.entries(fields).every(([field, max]) => {
    const value = text(form[field])
    return (field === 'employeeNumber' && !value) || (value.length <= max && new RegExp(`^(?:${OFFICER_FIELD_PATTERNS[field]})$`, 'u').test(value))
  }) && (!text(form.email) || text(form.email).length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(form.email))) && OFFICER_ROLES.includes(String(form.role || '').toUpperCase())
}

export const filterDepartmentOfficers = (accounts, departments, { search = '', role = 'ALL', status = 'ALL' } = {}) => {
  const term = text(search).toLowerCase()
  return accounts.filter((account) => {
    const department = departments.find((item) => Number(item.id) === Number(account.department_id))
    const haystack = [account.first_name, account.last_name, account.username, account.department_name, department?.department_name].join(' ').toLowerCase()
    return (!term || haystack.includes(term)) && (role === 'ALL' || account.role === role) && (status === 'ALL' || (status === 'ACTIVE') === Boolean(account.is_active))
  })
}
