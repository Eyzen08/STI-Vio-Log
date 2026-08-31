const normalizeDepartmentName = (value) => String(value || '')
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase()

export const resolveDepartmentId = (departments = [], typedName = '') => {
  const normalizedName = normalizeDepartmentName(typedName)
  if (!normalizedName) return null
  const match = departments.find((department) =>
    normalizeDepartmentName(department?.department_name) === normalizedName
  )
  const id = Number(match?.id)
  return Number.isInteger(id) && id > 0 ? id : null
}
