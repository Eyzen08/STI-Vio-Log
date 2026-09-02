import { passwordIsStrong } from './passwordPolicy.js'

export const REGISTRATION_STEPS = [
  { label: 'Student Identity', shortLabel: 'Identity' },
  { label: 'Academic Information', shortLabel: 'Academic' },
  { label: 'Parent/Guardian Information', shortLabel: 'Guardian' },
  { label: 'Account Security', shortLabel: 'Security' },
  { label: 'Review and Submit', shortLabel: 'Review' },
]

const required = (value, label) => value.trim() ? '' : `${label} is required.`
const titleCase = (value) => value.toLocaleLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, boundary, letter) => `${boundary}${letter.toLocaleUpperCase()}`)

export const formatRegistrationInput = (field, value) => {
  if (['firstName', 'middleName', 'lastName', 'guardianName', 'guardianRelationship'].includes(field)) return titleCase(value)
  if (field === 'suffix') {
    const formatted = titleCase(value)
    const suffix = formatted.trim().replace(/\.$/, '').toLocaleLowerCase()
    if (suffix === 'jr') return 'Jr.'
    if (suffix === 'sr') return 'Sr.'
    if (['ii', 'iii', 'iv', 'v'].includes(suffix)) return suffix.toLocaleUpperCase()
    return formatted
  }
  if (field === 'email') return value.toLocaleLowerCase()
  if (field === 'program' || field === 'section') return value.toLocaleUpperCase()
  return value
}

export const normalizeRegistration = (registration) => {
  const normalized = { ...registration }
  for (const field of ['firstName','middleName','lastName','suffix','guardianName','guardianRelationship','email','program','section']) {
    normalized[field] = formatRegistrationInput(field, registration[field]).trim()
  }
  for (const field of ['studentNumber','phoneNumber','guardianPhoneNumber']) normalized[field] = registration[field].trim()
  return normalized
}

const phoneError = (value, label) => {
  const length = value.trim().length
  return length >= 7 && length <= 30 ? '' : `${label} must contain 7 to 30 characters.`
}

export const registrationErrors = (registration) => {
  const values = normalizeRegistration(registration)
  return {
    firstName: required(values.firstName, 'First name'),
    lastName: required(values.lastName, 'Last name'),
    studentNumber: /^\d{11}$/.test(values.studentNumber) ? '' : 'Student number must contain exactly 11 digits.',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) ? '' : 'Enter a valid email address.',
    phoneNumber: phoneError(values.phoneNumber, 'Phone number'),
    program: required(values.program, 'Program'),
    section: required(values.section, 'Section'),
    yearLevel: /^[1-6]$/.test(String(values.yearLevel)) ? '' : 'Select a year level.',
    guardianName: required(values.guardianName, 'Guardian full name'),
    guardianRelationship: required(values.guardianRelationship, 'Relationship'),
    guardianPhoneNumber: phoneError(values.guardianPhoneNumber, 'Guardian contact number'),
    password: passwordIsStrong(values.password) ? '' : 'Password must satisfy all requirements.',
    confirmPassword: values.confirmPassword && values.confirmPassword === values.password ? '' : 'Passwords must match.',
  }
}

export const REGISTRATION_STEP_FIELDS = [
  ['firstName', 'lastName', 'studentNumber', 'email', 'phoneNumber'],
  ['program', 'section', 'yearLevel'],
  ['guardianName', 'guardianRelationship', 'guardianPhoneNumber'],
  ['password', 'confirmPassword'],
  [],
]

export const registrationStepIsValid = (registration, step) => {
  const errors = registrationErrors(registration)
  return REGISTRATION_STEP_FIELDS[step].every((field) => !errors[field])
}
