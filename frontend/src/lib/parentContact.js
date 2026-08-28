export const CONTACT_METHODS = [
  ['CALL', 'Phone call'], ['SMS', 'SMS'], ['IN_PERSON', 'In person'], ['OTHER', 'Other']
]
export const CONTACT_OUTCOMES = [
  ['REACHED', 'Reached'], ['NO_ANSWER', 'No answer'], ['LEFT_MESSAGE', 'Left message'], ['FOLLOW_UP', 'Follow-up needed'], ['OTHER', 'Other']
]

export const buildParentContactPayload = ({ guardianId, method, outcome, notes }) => ({
  guardian_id: Number(guardianId),
  contact_method: method,
  outcome,
  ...(String(notes || '').trim() ? { notes: String(notes).trim() } : {})
})

export const contactLabel = (value) => String(value || 'OTHER').replaceAll('_', ' ').toLocaleLowerCase().replace(/^./, (letter) => letter.toUpperCase())

