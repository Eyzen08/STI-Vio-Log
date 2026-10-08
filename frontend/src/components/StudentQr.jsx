import { useEffect, useState } from 'react'

import { getStudentQrPayload, qrDownloadName } from '../lib/studentQr.js'
import '../styles/student-portal.css'

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
      <section className="student-page student-qr-page" aria-live="polite">
        <div className="skeleton qr-page-heading-skeleton" />
        <div className="skeleton qr-code-skeleton" />
      </section>
    )
  }

  const unavailableMessage = error || renderError || (!payload ? 'No QR code is assigned to this student account.' : '')

  return (
    <section className="student-page student-qr-page" aria-labelledby="student-qr-title">
      <header className="page-intro portal-page-header qr-page-intro">
        <div>
          <h2 id="student-qr-title">My QR Code</h2>
          <p>Present this code to authorized staff when recording community-service attendance.</p>
        </div>
      </header>

      <div className="qr-display-card">
        {unavailableMessage ? (
          <div className="qr-unavailable" role="alert">
            <h3>QR Code Unavailable</h3>
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
                ? <img src={imageUrl} alt="Your STI Vio-Log attendance QR code" width="320" height="320" />
                : <div className="skeleton qr-code-skeleton" aria-label="Generating QR code" />}
            </div>

            {imageUrl && (
              <a className="qr-download-button" href={imageUrl} download={qrDownloadName(profile.student_number)}>
                Download QR code
              </a>
            )}
          </>
        )}
      </div>

      <aside className="qr-guidance" aria-label="QR code guidance">
        <p>Increase screen brightness for scanning. Keep your QR private and use only your own code. It contains your attendance code, never your password or login token.</p>
      </aside>
    </section>
  )
}

export default StudentQr
