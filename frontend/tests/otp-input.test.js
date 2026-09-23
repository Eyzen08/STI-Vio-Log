import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pasteOtpDigits, removeOtpDigit, replaceOtpDigit, sanitizeOtp } from '../src/lib/otpInput.js'

const component = await readFile(new URL('../src/components/OtpInput.jsx', import.meta.url), 'utf8')
const mfa = await readFile(new URL('../src/components/MfaChallenge.jsx', import.meta.url), 'utf8')
const password = await readFile(new URL('../src/components/StudentPasswordAccess.jsx', import.meta.url), 'utf8')
const onboarding = await readFile(new URL('../src/components/StudentOnboarding.jsx', import.meta.url), 'utf8')
const admin = await readFile(new URL('../src/components/AdminAccountSettings.jsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')

test('OTP helpers keep only six numeric digits', () => {
  assert.equal(sanitizeOtp('1a2-3 4567'), '123456')
  assert.equal(replaceOtpDigit('123', 3, 'x4'), '1234')
  assert.equal(replaceOtpDigit('1234', 2, ''), '124')
})

test('Backspace clears the current digit or moves to the previous digit', () => {
  assert.deepEqual(removeOtpDigit('1234', 3), { value: '123', focusIndex: 3 })
  assert.deepEqual(removeOtpDigit('123', 3), { value: '12', focusIndex: 2 })
})

test('paste accepts a full OTP and distributes shorter numeric content', () => {
  assert.equal(pasteOtpDigits('', 0, '12 34-56'), '123456')
  assert.equal(pasteOtpDigits('123456', 2, '98'), '129856')
  assert.equal(pasteOtpDigits('123', 0, 'not a code'), '123')
})

test('component exposes focus, paste, numeric, disabled, and accessible behavior', () => {
  assert.match(component, /inputRefs\.current\[.*\]\?\.focus\(\)/)
  assert.match(component, /onKeyDown=\{\(event\) => handleKeyDown/)
  assert.match(component, /onPaste=\{\(event\) => handlePaste/)
  assert.match(component, /inputMode="numeric"/)
  assert.match(component, /autoComplete=\{index === 0 \? 'one-time-code' : 'off'\}/)
  assert.match(component, /digit \$\{index \+ 1\} of \$\{OTP_LENGTH\}/)
  assert.match(component, /disabled=\{disabled\}/)
})

test('all six-digit verification flows use the shared component and recovery remains a text input', () => {
  for (const source of [mfa, password, onboarding, admin]) assert.match(source, /import OtpInput from '\.\/OtpInput\.jsx'/)
  assert.match(mfa, /recovery\?<label>Recovery code<input/)
  assert.match(mfa, /<OtpInput id="mfa-code"/)
  assert.match(password, /<OtpInput id="password-reset-code"/)
  assert.match(onboarding, /<OtpInput id="google-email-code"/)
  assert.match(admin, /<OtpInput id="admin-email-code"/)
})

test('OTP and MFA colors use semantic light and dark theme tokens', () => {
  assert.match(styles, /\.otp-input input,[\s\S]*background:var\(--control-background\);[\s\S]*color:var\(--text-primary\);/)
  assert.match(styles, /\.otp-input input:focus-visible[^}]*box-shadow:var\(--focus-ring\);/)
  assert.match(styles, /\.otp-input\[aria-invalid='true'\] input[^}]*var\(--status-danger-surface\)/)
  assert.match(styles, /\.mfa-form \.totp-countdown[^}]*background:var\(--surface-nested\);/)
  assert.match(styles, /@media \(max-width:390px\)[\s\S]*\.otp-input \{ gap:\.3rem; \}/)
})
