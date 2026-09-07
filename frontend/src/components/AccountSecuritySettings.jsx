import { useState } from 'react'
import { changePassword } from '../lib/api.js'
import { passwordIsStrong } from '../lib/passwordPolicy.js'
import PasswordField from './PasswordField.jsx'
import PasswordRequirements from './PasswordRequirements.jsx'

export default function AccountSecuritySettings({ token, user, onSession }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('')
    if (!passwordIsStrong(form.newPassword)) return setError('Complete all password requirements.')
    if (form.newPassword !== form.confirmPassword) return setError('New password confirmation does not match.')
    setBusy(true)
    try {
      const session = await changePassword({ token, currentPassword: form.currentPassword, newPassword: form.newPassword })
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setMessage('Password changed. Other active sessions have been signed out.')
      onSession(session)
    } catch (changeError) { setError(changeError.message) } finally { setBusy(false) }
  }
  return <div className="account-settings-page">
    <section className="table-card account-summary-card"><div><p className="eyebrow">Account identity</p><h2>{user.username}</h2><p>Your identifier is managed by the school. Contact the Discipline Office if it is incorrect.</p></div><dl><div><dt>Role</dt><dd>{String(user.role || '').replaceAll('_', ' ')}</dd></div><div><dt>Session security</dt><dd>Changing your password signs out other sessions.</dd></div></dl></section>
    <section className="table-card form-card"><div className="table-header"><div><h3>Change password</h3><span>Use a unique password you do not use elsewhere.</span></div></div><form className="login-form account-password-form" onSubmit={submit}>
      <PasswordField id="settings-current-password" label="Current password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} disabled={busy} autoComplete="current-password" />
      <PasswordField id="settings-new-password" label="New password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} disabled={busy} />
      <PasswordRequirements password={form.newPassword} />
      <PasswordField id="settings-confirm-password" label="Confirm new password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} disabled={busy} />
      {error && <p className="error-message" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
      <button disabled={busy}>{busy ? 'Changing password…' : 'Change password'}</button>
    </form></section>
  </div>
}
