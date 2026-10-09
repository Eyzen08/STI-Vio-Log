import { isValidStudentName, isValidStudentSuffix, normalizeNameSpacing } from './inputNormalization.js'

export const normalizeStudentGmail = (email) => typeof email === 'string' ? email.trim().toLowerCase() : ''

export const isValidStudentGmail = (email) => {
  const normalized = normalizeStudentGmail(email)
  return normalized.length <= 255 && /^[^\s@]+@gmail\.com$/.test(normalized)
}

export const reviewStudentAccount = (form) => {
  const details = {
    student_number: String(form.student_number || '').trim(),
    first_name: normalizeNameSpacing(form.first_name), last_name: normalizeNameSpacing(form.last_name),
    middle_name: normalizeNameSpacing(form.middle_name), suffix: String(form.suffix || '').trim(),
    email: normalizeStudentGmail(form.email)
  }
  if (!/^\d{11}$/.test(details.student_number)) throw new Error('Student Number must contain exactly 11 digits.')
  if (!isValidStudentName(details.first_name) || !isValidStudentName(details.last_name) || !isValidStudentName(details.middle_name,{optional:true})) throw new Error('Enter valid student names using letters and name punctuation.')
  if (!isValidStudentSuffix(details.suffix)) throw new Error('Select a valid suffix or None.')
  if (!isValidStudentGmail(details.email)) throw new Error('Enter a valid personal Gmail address (@gmail.com).')
  return details
}

export const correctStudentCredentialsGmail = async ({ apiUrl, token, studentId, email, reason, password, fetchImpl = globalThis.fetch }) => {
  const response = await fetchImpl(`${apiUrl}/api/students/${studentId}/credentials-email`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email: normalizeStudentGmail(email), reason: reason.trim(), temporary_password: password })
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.message || 'Unable to confirm Gmail correction. If credentials changed, close this dialog and issue a new temporary password.')
  return data
}

export const sendStudentCredentialsEmail = async ({ apiUrl, token, studentId, password, fetchImpl = globalThis.fetch }) => {
  const response = await fetchImpl(`${apiUrl}/api/students/${studentId}/credentials-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ temporary_password: password })
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(data.message || 'Email could not be sent. Retry or copy the credentials for manual sharing.')
  return data
}
