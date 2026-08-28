export const pendingRegistrationCount = (response) =>
  Array.isArray(response?.registrations) ? response.registrations.length : 0

export const formatPendingRegistrationCount = (count) => {
  const value = Number(count)
  if (!Number.isInteger(value) || value < 1) return ''
  return value > 99 ? '99+' : String(value)
}

