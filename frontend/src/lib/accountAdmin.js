export const STAFF_ROLES = ['ADMIN', 'DISCIPLINE_OFFICE']

export const buildStaffAccountPayload = (form = {}) => ({
  username:String(form.username||'').trim().toLowerCase(), role:String(form.role||'').trim().toUpperCase(),
  first_name:String(form.firstName||'').trim(), last_name:String(form.lastName||'').trim(),
  employee_number:String(form.employeeNumber||'').trim() || undefined,
  email:String(form.email||'').trim().toLowerCase() || undefined
})

export const accountStatusLabel = (account) => account?.is_active ? 'Active' : 'Inactive'
export const clearOneTimeSecret = () => null

export const buildGoogleRecoveryPayload = (reason = '') => ({ reason: String(reason).trim() })
