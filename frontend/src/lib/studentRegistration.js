import { passwordIsStrong } from './passwordPolicy.js'

export const REGISTRATION_STEPS = [
  { label: 'Student Identity', shortLabel: 'Identity' },
  { label: 'Academic Information', shortLabel: 'Academic' },
  { label: 'Parent/Guardian Information', shortLabel: 'Guardian' },
  { label: 'Account Security', shortLabel: 'Security' },
  { label: 'Review and Submit', shortLabel: 'Review' },
]

const required = (value, label) => value.trim() ? '' : `${label} is required.`
const phoneError = (value, label) => {
  const length = value.trim().length
  return length >= 7 && length <= 30 ? '' : `${label} must contain 7 to 30 characters.`
}

export const registrationErrors = (registration) => ({
  firstName: required(registration.firstName, 'First name'),
  lastName: required(registration.lastName, 'Last name'),
  studentNumber: /^\d{11}$/.test(registration.studentNumber) ? '' : 'Student number must contain exactly 11 digits.',
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registration.email.trim()) ? '' : 'Enter a valid email address.',
  phoneNumber: phoneError(registration.phoneNumber, 'Phone number'),
  program: required(registration.program, 'Program'),
  section: required(registration.section, 'Section'),
  yearLevel: /^[1-6]$/.test(String(registration.yearLevel)) ? '' : 'Select a year level.',
  guardianName: required(registration.guardianName, 'Guardian full name'),
  guardianRelationship: required(registration.guardianRelationship, 'Relationship'),
  guardianPhoneNumber: phoneError(registration.guardianPhoneNumber, 'Guardian contact number'),
  password: passwordIsStrong(registration.password) ? '' : 'Password must satisfy all requirements.',
  confirmPassword: registration.confirmPassword && registration.confirmPassword === registration.password ? '' : 'Passwords must match.',
})

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
