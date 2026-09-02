export const passwordRequirements = (value = '') => ({
  length: value.length >= 8 && value.length <= 128,
  uppercase: /[A-Z]/.test(value),
  number: /\d/.test(value),
  special: /[^A-Za-z0-9]/.test(value)
})

export const passwordIsStrong = (value) => Object.values(passwordRequirements(value)).every(Boolean)

