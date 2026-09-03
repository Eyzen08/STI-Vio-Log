export const OFFICER_ROLES = ['DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD']

const text = (value) => String(value || '').trim().replace(/\s+/g, ' ')

export const buildDepartmentOfficerPayload = (form = {}) => ({
  department_name: text(form.departmentName),
  department_type: text(form.departmentType).toUpperCase(),
  description: text(form.description) || undefined,
  department_status: form.departmentStatus === 'inactive' ? 'inactive' : 'active',
  username: text(form.username).toLowerCase(),
  role: String(form.role || '').toUpperCase(),
  first_name: text(form.firstName),
  last_name: text(form.lastName),
  employee_number: text(form.employeeNumber) || undefined,
  email: text(form.email).toLowerCase() || undefined
})

export const departmentStepValid = (form) => Boolean(text(form.departmentName) && text(form.departmentType))
export const officerStepValid = (form) => Boolean(text(form.firstName) && text(form.lastName) && text(form.username) && OFFICER_ROLES.includes(String(form.role || '').toUpperCase()))

export const filterDepartmentOfficers = (accounts, departments, { search = '', role = 'ALL', status = 'ALL' } = {}) => {
  const term = text(search).toLowerCase()
  return accounts.filter((account) => {
    const department = departments.find((item) => Number(item.id) === Number(account.department_id))
    const haystack = [account.first_name, account.last_name, account.username, account.department_name, department?.department_name].join(' ').toLowerCase()
    return (!term || haystack.includes(term)) && (role === 'ALL' || account.role === role) && (status === 'ALL' || (status === 'ACTIVE') === Boolean(account.is_active))
  })
}
