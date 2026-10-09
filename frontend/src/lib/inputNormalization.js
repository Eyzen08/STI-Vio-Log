export const capitalizeWords = (value) => String(value ?? '').replace(/(^|\s)(\p{L})/gu, (_, space, letter) => `${space}${letter.toLocaleUpperCase()}`)

export const digitsOnly = (value, maxLength = 11) => String(value ?? '').replace(/\D/g, '').slice(0, maxLength)

export const STUDENT_NUMBER_PATTERN = '[0-9]{11}'

export { STUDENT_NAME_PATTERN, STUDENT_SUFFIXES, normalizeNameSpacing, isValidStudentName, isValidStudentSuffix } from '../../../shared/studentIdentity.mjs'
export const normalizePersonName = value => capitalizeWords(String(value ?? '').normalize('NFC').replace(/\s/gu, ' ').replace(/[^\p{L}\p{M} .'’-]/gu, ''))
export const normalizeStudentSearch = (value, labels = []) => labels.includes(value) ? value : String(value ?? '').normalize('NFC').replace(/\s/gu, ' ').replace(/[^\p{L}\p{M}0-9 .'’-]/gu, '')
export const emailWithoutSpaces = value => String(value ?? '').replace(/\s/gu, '')
export const wholeNumberInput = (value, previous = '') => /^[0-9]*$/.test(value) ? value : previous

