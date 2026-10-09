export const STUDENT_NAME_PATTERN = String.raw`(?=.*\p{L})[\p{L}\p{M} .'’\-]+`
export const STUDENT_SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
export const normalizeNameSpacing = value => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, ' ') : ''
export const isValidStudentName = (value, { optional = false, maxLength = 150 } = {}) => {
  if (value == null) return optional
  if (typeof value !== 'string') return false
  const name = normalizeNameSpacing(value)
  return optional && !name || name.length <= maxLength && new RegExp(`^(?:${STUDENT_NAME_PATTERN})$`, 'u').test(name)
}
export const isValidStudentSuffix = value => value == null || typeof value === 'string' && (!value.trim() || STUDENT_SUFFIXES.includes(value.trim()))
