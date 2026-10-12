import { formatDisplayLabel } from './displayFormat.js'

export const CONTACT_METHODS = [
  ['CALL', 'Phone Call'], ['SMS', 'SMS'], ['IN_PERSON', 'In Person'], ['OTHER', 'Other']
]
export const CONTACT_OUTCOMES = [
  ['REACHED', 'Reached'], ['NO_ANSWER', 'No Answer'], ['LEFT_MESSAGE', 'Left Message'], ['FOLLOW_UP', 'Follow-Up Needed'], ['OTHER', 'Other']
]

export const buildParentContactPayload = ({ guardianId, method, outcome, notes }) => ({
  guardian_id: Number(guardianId),
  contact_method: method,
  outcome,
  ...(String(notes || '').trim() ? { notes: String(notes).trim() } : {})
})

export const contactLabel = (value) => formatDisplayLabel(value || 'OTHER')
