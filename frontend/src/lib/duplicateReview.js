export const DUPLICATE_TYPE_LABELS = { STUDENT_NUMBER: 'Student Number', EMPLOYEE_NUMBER: 'Employee Number', USERNAME: 'Username', GOOGLE_IDENTITY: 'Google Identity' }
export const duplicateTypeLabel = (type) => DUPLICATE_TYPE_LABELS[type] || 'Possible Duplicate'
export const duplicateSummaryTotal = (summary = {}) => Number(summary.total) || 0
