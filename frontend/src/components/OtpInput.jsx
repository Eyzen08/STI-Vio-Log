import { useEffect, useRef } from 'react'
import { OTP_LENGTH, pasteOtpDigits, removeOtpDigit, replaceOtpDigit, sanitizeOtp } from '../lib/otpInput.js'

export default function OtpInput({
  value,
  onChange,
  disabled = false,
  label = 'Verification code',
  id = 'otp-code',
  describedBy,
  invalid = false,
  autoFocus = false,
  required = true,
}) {
  const inputRefs = useRef([])
  const code = sanitizeOtp(value)

  useEffect(() => {
    if (autoFocus && !disabled) inputRefs.current[0]?.focus()
  }, [autoFocus, disabled])

  const focusDigit = (index) => inputRefs.current[Math.max(0, Math.min(index, OTP_LENGTH - 1))]?.focus()

  const handleChange = (index, event) => {
    const entered = sanitizeOtp(event.target.value)
    if (entered.length > 1) {
      const next = pasteOtpDigits(code, index, entered)
      onChange(next)
      focusDigit(Math.min(index + entered.length, OTP_LENGTH - 1))
      return
    }
    const next = replaceOtpDigit(code, index, entered)
    onChange(next)
    if (entered) focusDigit(index + 1)
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const next = removeOtpDigit(code, index)
      onChange(next.value)
      focusDigit(next.focusIndex)
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusDigit(index - 1)
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusDigit(index + 1)
      return
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1 && !/^\d$/.test(event.key)) {
      event.preventDefault()
    }
  }

  const handlePaste = (index, event) => {
    const pasted = sanitizeOtp(event.clipboardData.getData('text'))
    if (!pasted) return
    event.preventDefault()
    onChange(pasteOtpDigits(code, index, pasted))
    focusDigit(Math.min(index + pasted.length, OTP_LENGTH - 1))
  }

  return <div className="otp-field">
    <span className="otp-label" id={`${id}-label`}>{label}</span>
    <div className="otp-input" role="group" aria-labelledby={`${id}-label`} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
      {Array.from({ length: OTP_LENGTH }, (_, index) => <input
        key={index}
        ref={(node) => { inputRefs.current[index] = node }}
        id={`${id}-${index + 1}`}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={1}
        value={code[index] || ''}
        onChange={(event) => handleChange(index, event)}
        onKeyDown={(event) => handleKeyDown(index, event)}
        onPaste={(event) => handlePaste(index, event)}
        onFocus={(event) => event.target.select()}
        autoComplete={index === 0 ? 'one-time-code' : 'off'}
        aria-label={`${label}, digit ${index + 1} of ${OTP_LENGTH}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        required={required}
        disabled={disabled}
      />)}
    </div>
  </div>
}
