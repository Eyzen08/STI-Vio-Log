import { useRef, useState } from 'react'
import { API_URL } from '../lib/api.js'
import { sendStudentCredentialsEmail } from '../lib/studentAccount.js'
import AsyncActionButton from './AsyncActionButton.jsx'
import Modal from './Modal.jsx'

export default function StudentCredentialsModal({ credentials, token, onClose }) {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const sending = useRef(false)
  const sendEmail = async () => {
    if (sending.current || sent) return
    sending.current = true
    setBusy(true)
    setError('')
    try {
      await sendStudentCredentialsEmail({ apiUrl: API_URL, token, studentId: credentials.studentId, password: credentials.password })
      setSent(true)
    } catch {
      setError('Account created, but email could not be sent. Retry or copy the credentials for manual sharing.')
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return <Modal title="Temporary student credentials" onClose={onClose}>
    <div className="registration-pending student-credentials">
      <strong>Student account created</strong>
      <p>Student Number (username): <code>{credentials.username}</code></p>
      <p>Temporary password: <code>{credentials.password}</code></p>
      <p>Student Gmail: <strong>{credentials.email}</strong></p>
      <p>The password expires after 24 hours. The student must change this password, confirm the recorded Gmail by OTP, sign in with that same Google account, and complete academic, contact, and guardian information before entering the portal.</p>
      <p>Send the email or copy these credentials now. This password will not be shown again after closing.</p>
      {sent && <p className="success-message" role="status">Email sent to {credentials.email}. Ask the student to check their inbox and spam folder.</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="student-credentials-actions">
        <AsyncActionButton type="button" busy={busy} busyLabel="Sending…" disabled={sent} onClick={sendEmail}>
          {sent ? 'Email sent' : error ? 'Retry Email' : 'Send Email'}
        </AsyncActionButton>
        <button type="button" className="secondary-button" onClick={onClose}>I stored it securely</button>
      </div>
    </div>
  </Modal>
}
