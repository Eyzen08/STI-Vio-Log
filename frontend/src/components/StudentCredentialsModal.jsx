import { useRef, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { correctStudentCredentialsGmail, isValidStudentGmail, normalizeStudentGmail, sendStudentCredentialsEmail } from '../lib/studentAccount.js'
import AsyncActionButton from './AsyncActionButton.jsx'
import Modal from './Modal.jsx'

export default function StudentCredentialsModal({ credentials, token, onClose, onUpdated }) {
  const [busy, setBusy] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState(credentials.email)
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const acting = useRef(false)
  const editButton = useRef(null)
  const close = () => { if (!acting.current) onClose() }
  const cancelEdit = () => { setEditing(false); setEmail(credentials.email); setReason(''); setError(''); requestAnimationFrame(() => editButton.current?.focus()) }
  const saveGmail = async (event) => {
    event.preventDefault()
    if (acting.current || !isValidStudentGmail(email) || !reason.trim() || normalizeStudentGmail(email) === credentials.email) return
    acting.current = true
    setBusy('save')
    setError('')
    try {
      const data = await correctStudentCredentialsGmail({ apiUrl: API_URL, token, studentId: credentials.studentId, email, reason, password: credentials.password })
      onUpdated(data)
      setEmail(data.student.email)
      setSent(false)
      setEditing(false)
      setReason('')
      setNotice('Gmail saved and temporary password replaced. Review the address, then click Send Email.')
      requestAnimationFrame(() => editButton.current?.focus())
    } catch (saveError) {
      setError(saveError.message || 'Unable to confirm the correction. Close this dialog and issue a new temporary password if credentials changed.')
    } finally {
      acting.current = false
      setBusy('')
    }
  }
  const sendEmail = async () => {
    if (acting.current || sent || editing) return
    acting.current = true
    setBusy('send')
    setError('')
    try {
      await sendStudentCredentialsEmail({ apiUrl: API_URL, token, studentId: credentials.studentId, password: credentials.password })
      setSent(true)
      setNotice('')
    } catch {
      setError('Account created, but email could not be sent. Retry or copy the credentials for manual sharing.')
    } finally {
      acting.current = false
      setBusy('')
    }
  }

  return <Modal title="Temporary student credentials" onClose={close} dirty={!busy && editing && (email !== credentials.email || Boolean(reason.trim()))}>
    <div className="registration-pending student-credentials">
      <strong>Student account created</strong>
      <p>Student Number (username): <code>{credentials.username}</code></p>
      <p>Temporary password: <code>{credentials.password}</code></p>
      <p className="student-credentials-gmail">Student Gmail: <strong>{credentials.email}</strong><button ref={editButton} type="button" className="secondary-button" disabled={Boolean(busy) || editing} onClick={() => { setEmail(credentials.email); setReason(''); setError(''); setNotice(''); setEditing(true) }}>Edit Gmail</button></p>
      {editing && <form className="student-credentials-edit student-form" onSubmit={saveGmail}>
        <label>Student Gmail<input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={255} pattern="[^ @]+@[gG][mM][aA][iI][lL][.][cC][oO][mM]" autoComplete="email" disabled={Boolean(busy)} required autoFocus/></label>
        <label>Reason for correction<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} disabled={Boolean(busy)} required/></label>
        <p>Saving replaces the old temporary password and gives the replacement a new 24-hour expiry. Email is sent only when you click Send Email.</p>
        <div className="student-credentials-actions"><AsyncActionButton type="submit" busy={busy === 'save'} busyLabel="Saving…" disabled={Boolean(busy) || !isValidStudentGmail(email) || !reason.trim() || normalizeStudentGmail(email) === credentials.email}>Save Gmail</AsyncActionButton><button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={cancelEdit}>Cancel</button></div>
      </form>}
      <p>The password expires after 24 hours. The student must change this password, confirm the recorded Gmail by OTP, sign in with that same Google account, and complete academic, contact, and guardian information before entering the portal.</p>
      <p>Send the email or copy these credentials now. This password will not be shown again after closing.</p>
      {sent && <p className="success-message" role="status">Email sent to {credentials.email}. Ask the student to check their inbox and spam folder.</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="student-credentials-actions">
        <AsyncActionButton type="button" busy={busy === 'send'} busyLabel="Sending…" disabled={sent || editing || Boolean(busy)} onClick={sendEmail}>
          {sent ? 'Email sent' : error ? 'Retry Email' : 'Send Email'}
        </AsyncActionButton>
        <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={close}>I stored it securely</button>
      </div>
    </div>
  </Modal>
}
