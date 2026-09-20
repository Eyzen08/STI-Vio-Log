export const philippineMobileDigits = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  const national = digits.startsWith('63') ? digits.slice(2) : digits.startsWith('0') ? digits.slice(1) : digits
  if (!national) return ''
  if (national[0] !== '9') return ''
  return national.slice(0, 10)
}

export const formatPhilippinePhone = (value) => {
  const digits = philippineMobileDigits(value)
  if (!digits) return ''
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean)
  return `+63 ${groups.join(' ')}`
}

export const normalizePhilippinePhone = (value) => {
  const digits = philippineMobileDigits(value)
  return /^9\d{9}$/.test(digits) ? `+63${digits}` : null
}

export const isValidPhilippinePhone = (value) => !value || Boolean(normalizePhilippinePhone(value))

export const displayPhilippinePhone = (value) => normalizePhilippinePhone(value) ? formatPhilippinePhone(value) : value || ''
