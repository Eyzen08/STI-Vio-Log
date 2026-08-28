export const DUPLICATE_TYPE_LABELS = { STUDENT_NUMBER: 'Student number', EMPLOYEE_NUMBER: 'Employee number', USERNAME: 'Username', GOOGLE_IDENTITY: 'Google identity' }
export const duplicateTypeLabel = (type) => DUPLICATE_TYPE_LABELS[type] || 'Possible duplicate'
export const duplicateSummaryTotal = (summary = {}) => Number(summary.total) || 0
