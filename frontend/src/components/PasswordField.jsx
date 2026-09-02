import { useState } from 'react'

export default function PasswordField({ label, id, value, onChange, disabled, placeholder='', autoComplete='new-password', required=true, autoFocus=false }) {
  const [visible, setVisible] = useState(false)
  return <label htmlFor={id}>{label}<span className="password-input-wrap">
    <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} disabled={disabled} placeholder={placeholder}
      autoComplete={autoComplete} required={required} autoFocus={autoFocus} minLength="8" maxLength="128" />
    <button type="button" className="password-visibility" onClick={() => setVisible((current) => !current)}
      aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} disabled={disabled}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible&&<path d="M3 3l18 18"/>}</svg>
    </button>
  </span></label>
}
