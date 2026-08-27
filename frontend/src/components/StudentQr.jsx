import { useEffect, useState } from 'react'

import { getStudentQrPayload, qrDownloadName } from '../lib/studentQr.js'

function StudentQr({ profile, loading, error }) {
  const [imageUrl, setImageUrl] = useState('')
  const [renderError, setRenderError] = useState('')
  const payload = getStudentQrPayload(profile)

  useEffect(() => {
    let active = true
    setImageUrl('')
    setRenderError('')

    if (!payload) return () => { active = false }

    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'H',
        margin: 3,
        width: 720,
        color: { dark: '#122033', light: '#ffffff' }
      }))
      .then((url) => { if (active) setImageUrl(url) })
      .catch(() => { if (active) setRenderError('Your QR code could not be rendered.') })

    return () => { active = false }
  }, [payload])

  if (loading) {
    return (
      <section className="student-qr-page" aria-live="polite">
        <div className="skeleton qr-page-heading-skeleton" />
        <div className="skeleton qr-code-skeleton" />
      </section>
    )
  }

  const unavailableMessage = error || renderError || (!payload ? 'No QR code is assigned to this student account.' : '')

  return (
    <section className="student-qr-page" aria-labelledby="student-qr-title">
      <header className="page-intro qr-page-intro">
        <div>
          <p className="eyebrow">Student identification</p>
          <h2 id="student-qr-title">My QR code</h2>
          <p>Present this code to authorized staff when recording community-service attendance.</p>
        </div>
        <span className="profile-readonly-badge">Personal code</span>
      </header>

      <div className="qr-display-card">
        {unavailableMessage ? (
          <div className="qr-unavailable" role="alert">
            <h3>QR code unavailable</h3>
            <p>{unavailableMessage}</p>
          </div>
        ) : (
          <>
            <div className="qr-student-summary">
              <strong>{profile.first_name} {profile.last_name}</strong>
              <span>{profile.student_number}</span>
            </div>

            <div className="student-qr-frame">
              {imageUrl
                ? <img src={imageUrl} alt="Your STI Vio-Log attendance QR code" />
                : <div className="skeleton qr-code-skeleton" aria-label="Generating QR code" />}
            </div>

            <p className="qr-security-note">
              This QR contains only your system-issued attendance code. It does not contain your password or login token.
            </p>

            {imageUrl && (
              <a className="qr-download-button" href={imageUrl} download={qrDownloadName(profile.student_number)}>
                Download QR code
              </a>
            )}
          </>
        )}
      </div>

      <aside className="qr-guidance" aria-label="QR code guidance">
        <div><strong>Keep it private</strong><span>Do not post your personal QR publicly.</span></div>
        <div><strong>Increase brightness</strong><span>A bright screen helps staff scan quickly.</span></div>
        <div><strong>Use only your code</strong><span>Attendance is linked to your student account.</span></div>
      </aside>
    </section>
  )
}

export default StudentQr
