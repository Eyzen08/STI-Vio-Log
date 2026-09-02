import { passwordRequirements } from '../lib/passwordPolicy.js'

export default function PasswordRequirements({ password }) {
  const requirements = passwordRequirements(password)
  const rows = [
    ['length', '8 or more characters'],
    ['uppercase', 'One uppercase letter'],
    ['number', 'One number'],
    ['special', 'One special character']
  ]
  return <div className="password-requirements" aria-live="polite"><strong>Password requirements</strong><ul>
    {rows.map(([key, label]) => <li key={key} className={requirements[key] ? 'valid' : 'invalid'}>
      <span aria-hidden="true">{requirements[key] ? '✓' : '○'}</span> {label} <span className="sr-only">{requirements[key] ? 'met' : 'not met'}</span>
    </li>)}
  </ul></div>
}

