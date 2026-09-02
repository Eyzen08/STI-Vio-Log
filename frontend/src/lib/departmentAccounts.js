const normalizeDepartmentLabel = (value) => String(value || '')
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase()

export const departmentTypeLabel = (department = {}) =>
  department.department_code || department.department_name || 'Unnamed department'

export const resolveDepartmentId = (departments = [], typedLabel = '') => {
  const normalizedLabel = normalizeDepartmentLabel(typedLabel)
  if (!normalizedLabel) return null
  const match = departments.find((department) =>
    normalizeDepartmentLabel(departmentTypeLabel(department)) === normalizedLabel
  )
  const id = Number(match?.id)
  return Number.isInteger(id) && id > 0 ? id : null
}
