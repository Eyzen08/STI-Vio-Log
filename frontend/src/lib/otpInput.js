export const OTP_LENGTH = 6

export const sanitizeOtp = (value) => String(value ?? '').replace(/\D/g, '').slice(0, OTP_LENGTH)

export const replaceOtpDigit = (value, index, input) => {
  const digits = sanitizeOtp(value).split('')
  const nextDigit = sanitizeOtp(input).slice(-1)
  if (!nextDigit) {
    digits.splice(index, 1)
    return digits.join('')
  }
  digits[index] = nextDigit
  return digits.join('').slice(0, OTP_LENGTH)
}

export const removeOtpDigit = (value, index) => {
  const digits = sanitizeOtp(value).split('')
  const target = digits[index] ? index : Math.max(0, index - 1)
  digits.splice(target, 1)
  return { value: digits.join(''), focusIndex: target }
}

export const pasteOtpDigits = (value, index, pastedValue) => {
  const pasted = sanitizeOtp(pastedValue)
  if (!pasted) return sanitizeOtp(value)
  if (pasted.length === OTP_LENGTH) return pasted
  const digits = sanitizeOtp(value).split('')
  pasted.split('').forEach((digit, offset) => {
    if (index + offset < OTP_LENGTH) digits[index + offset] = digit
  })
  return digits.join('').slice(0, OTP_LENGTH)
}
