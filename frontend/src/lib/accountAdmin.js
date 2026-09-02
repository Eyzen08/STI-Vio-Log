export const STAFF_ROLES = ['DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD']
export const ASSIGNABLE_STAFF_ROLES = ['DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD']

export const buildStaffAccountPayload = (form = {}) => ({
  username:String(form.username||'').trim().toLowerCase(), role:String(form.role||'').trim().toUpperCase(),
  first_name:String(form.firstName||'').trim(), last_name:String(form.lastName||'').trim(),
  employee_number:String(form.employeeNumber||'').trim() || undefined,
  email:String(form.email||'').trim().toLowerCase() || undefined,
  ...(String(form.role||'').trim().toUpperCase()==='DEPARTMENT_HEAD' ? {department_id:Number(form.departmentId)} : {})
})

export const accountStatusLabel = (account) => account?.is_active ? 'Active' : 'Inactive'
export const clearOneTimeSecret = () => null

export const buildGoogleRecoveryPayload = (reason = '') => ({ reason: String(reason).trim() })

export const buildAccountAssignmentPayload = ({ role, departmentId, reason } = {}) => ({
  role: String(role || '').trim().toUpperCase(),
  department_id: String(role || '').trim().toUpperCase() === 'DEPARTMENT_HEAD' ? Number(departmentId) : null,
  reason: String(reason || '').trim()
})
