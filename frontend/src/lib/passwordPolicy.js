export const passwordRequirements = (value = '') => ({
  length: value.length >= 12 && value.length <= 128,
  uppercase: /[A-Z]/.test(value),
  number: /\d/.test(value),
  special: /[^A-Za-z0-9]/.test(value),
  uncommon: !new Set(['password123!','password@123','qwerty123!','admin123!','welcome123!','letmein123!','student123!']).has(value.normalize('NFKC').toLowerCase())
})

export const passwordIsStrong = (value) => Object.values(passwordRequirements(value)).every(Boolean)
