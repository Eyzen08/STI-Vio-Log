import { isValidStudentName, isValidStudentSuffix, normalizeNameSpacing } from './inputNormalization.js'
import { ACADEMIC_LEVELS, STRANDS } from './studentAcademic.js'
import { COLLEGE_PROGRAMS, TESDA_PROGRAMS } from './programNames.js'
import { normalizePhilippinePhone } from './phone.js'
import { manilaToday, incidentDateError } from './displayFormat.js'

export const normalizeStudentGmail = (email) => typeof email === 'string' ? email.trim().toLowerCase() : ''

export const isValidStudentGmail = (email) => {
  const normalized = normalizeStudentGmail(email)
  return normalized.length <= 255 && /^[^\s@]+@gmail\.com$/.test(normalized)
}

export const emptyStudentForm = () => ({
  student_number: '', first_name: '', middle_name: '', last_name: '', suffix: '', email: '',
  academic_level: 'COLLEGE', strand: '', program: '', section: '', year_level: '',
  phone_number: '', guardian_name: '', guardian_relationship: '', guardian_phone_number: '',
  include_first_violation: false, violation_type_id: '', incident_date: manilaToday(),
  incident_time: '', exact_offense: '', incident_details: ''
})

const reviewAcademic = (form) => {
  const academicLevel = String(form.academic_level || '').trim().toUpperCase()
  const section = String(form.section || '').normalize('NFKC').trim()
  if (!ACADEMIC_LEVELS.some(([code]) => code === academicLevel)) throw new Error('Select College, Senior High School, or TESDA.')
  if (!section) throw new Error('Enter the student section.')
  if (academicLevel === 'COLLEGE') {
    const program = String(form.program || '').trim().toUpperCase()
    if (!Object.hasOwn(COLLEGE_PROGRAMS, program)) throw new Error('Select a valid college program.')
    const year = Number(form.year_level)
    if (![1, 2, 3, 4].includes(year)) throw new Error('College year level must be between 1 and 4.')
    return { academic_level: academicLevel, strand: null, program, section, year_level: year }
  }
  if (academicLevel === 'SENIOR_HIGH_SCHOOL') {
    const strand = String(form.strand || '').trim().toUpperCase()
    if (!STRANDS.some(([code]) => code === strand)) throw new Error('Select a valid Senior High School strand.')
    const year = Number(form.year_level)
    if (![11, 12].includes(year)) throw new Error('Select Grade 11 or Grade 12.')
    return { academic_level: academicLevel, strand, program: null, section, year_level: year }
  }
  const program = String(form.program || '').trim().toUpperCase()
  if (!Object.hasOwn(TESDA_PROGRAMS, program)) throw new Error('Select a valid TESDA program.')
  return { academic_level: 'TESDA', strand: null, program, section, year_level: null }
}

const reviewFirstViolation = (form) => {
  if (!form.include_first_violation) return null
  const incidentDate = String(form.incident_date || '').trim()
  if (!form.violation_type_id) throw new Error('Select the first violation classification.')
  const dateError = incidentDateError(incidentDate)
  if (dateError) throw new Error(dateError)
  if (!String(form.incident_time || '').trim()) throw new Error('Enter the first violation incident time.')
  if (!String(form.exact_offense || '').trim()) throw new Error('Select the specific handbook offense.')
  if (!String(form.incident_details || '').trim()) throw new Error('Enter the first violation incident details.')
  return {
    violation_type_id: Number(form.violation_type_id),
    incident_date: incidentDate,
    incident_time: String(form.incident_time).trim(),
    description: `Handbook offense: ${String(form.exact_offense).trim()}\nIncident details: ${String(form.incident_details).trim()}`
  }
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

  const academic = reviewAcademic(form)

  const phoneNumber = normalizePhilippinePhone(form.phone_number)
  const guardianPhoneNumber = normalizePhilippinePhone(form.guardian_phone_number)
  if (!phoneNumber) throw new Error('Enter a valid Philippine student contact number.')
  if (!guardianPhoneNumber) throw new Error('Enter a valid Philippine guardian contact number.')
  if (phoneNumber === guardianPhoneNumber) throw new Error('Student and guardian contact numbers must be different.')

  const guardianName = normalizeNameSpacing(form.guardian_name)
  if (!isValidStudentName(guardianName, { maxLength: 200 })) throw new Error('Enter a valid guardian name using letters and name punctuation.')
  const guardianRelationship = String(form.guardian_relationship || '').trim()
  if (!guardianRelationship) throw new Error('Enter the guardian relationship.')

  const firstViolation = reviewFirstViolation(form)

  return {
    ...details,
    ...academic,
    phone_number: phoneNumber,
    guardian_name: guardianName,
    guardian_relationship: guardianRelationship,
    guardian_phone_number: guardianPhoneNumber,
    ...(firstViolation ? { first_violation: firstViolation } : {})
  }
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
