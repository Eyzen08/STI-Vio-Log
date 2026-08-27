export const formatStudentName = (student) => {
  if (!student) return 'Student profile'

  return [student.first_name, student.middle_name, student.last_name, student.suffix]
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim())
    .join(' ')
}

export const displayProfileValue = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return 'Not provided'
  return String(value)
}

export const formatYearLevel = (yearLevel) => {
  const numericYear = Number(yearLevel)
  if (!Number.isInteger(numericYear) || numericYear < 1) return 'Not provided'

  const suffix = numericYear % 10 === 1 && numericYear % 100 !== 11
    ? 'st'
    : numericYear % 10 === 2 && numericYear % 100 !== 12
      ? 'nd'
      : numericYear % 10 === 3 && numericYear % 100 !== 13
        ? 'rd'
        : 'th'

  return `${numericYear}${suffix} year`
}
