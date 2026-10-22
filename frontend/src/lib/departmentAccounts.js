const normalizeDepartmentLabel = (value) => String(value || '')
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase()

export const departmentTypeLabel = (department = {}) => {
  const code = String(department.department_code || '').trim()
  const name = String(department.department_name || '').trim()
  // Legacy records store the readable department label in the code field.
  return /\s/.test(code) ? code : name || code || 'Unnamed department'
}

export const resolveDepartmentId = (departments = [], typedLabel = '') => {
  const normalizedLabel = normalizeDepartmentLabel(typedLabel)
  if (!normalizedLabel) return null
  const match = departments.find((department) =>
    normalizeDepartmentLabel(departmentTypeLabel(department)) === normalizedLabel
  )
  const id = Number(match?.id)
  return Number.isInteger(id) && id > 0 ? id : null
}
