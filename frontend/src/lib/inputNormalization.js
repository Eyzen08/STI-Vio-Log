export const capitalizeWords = (value) => String(value ?? '').replace(/(^|\s)(\p{L})/gu, (_, space, letter) => `${space}${letter.toLocaleUpperCase()}`)

export const digitsOnly = (value, maxLength = 11) => String(value ?? '').replace(/\D/g, '').slice(0, maxLength)

export const STUDENT_NUMBER_PATTERN = '[0-9]{11}'

