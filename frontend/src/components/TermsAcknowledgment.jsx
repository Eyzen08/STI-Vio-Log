import { useEffect, useRef, useState } from 'react'
import AsyncActionButton from './AsyncActionButton.jsx'
import PolicyLinks from './PolicyLinks.jsx'
import { apiRequest } from '../lib/api.js'

export default function TermsAcknowledgment({ status, error, onStatus, onRetry, onOpenPolicy, onLogout }) {
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const checking = !status && !error
  const heading = useRef(null)
  useEffect(() => { heading.current?.focus() }, [status?.required])
  const acknowledge = async () => {
    setBusy(true)
    setSaveError('')
    try {
      const data = await apiRequest('/api/auth/legal/acknowledge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgment_version: status.acknowledgment_version, terms_version: status.terms_version, privacy_notice_version: status.privacy_notice_version })
      })
      onStatus(data.legal)
    } catch (failure) {
      setSaveError(failure.message)
      if (failure.code === 'LEGAL_POLICY_CHANGED' || failure.code === 'LEGAL_ACKNOWLEDGMENT_DISABLED') onRetry()
    } finally { setBusy(false) }
  }
  return <section className={`legal-acknowledgment${status?.required ? '' : ' legal-acknowledgment--compact'}`} aria-labelledby="terms-acknowledgment-title" aria-busy={checking || busy}>
    <p className="eyebrow">STI Vio-Log</p>
    <h1 id="terms-acknowledgment-title" ref={heading} tabIndex="-1">{status?.required ? 'Review the Terms of Use' : 'Checking Account Access'}</h1>
    {status?.required ? <>
      <p>Review the Terms of Use before continuing. The Privacy Notice explains how the portal handles your information.</p>
      <dl className="legal-document-versions"><div><dt>Terms Version</dt><dd>{status.terms_version}</dd></div><div><dt>Privacy Notice Version</dt><dd>{status.privacy_notice_version}</dd></div></dl>
    </> : checking && <p className="account-check-status" role="status"><span className="action-spinner" aria-hidden="true" />Verifying Terms acknowledgment…</p>}
    <PolicyLinks onOpenPolicy={onOpenPolicy}/>
    {(error || saveError) && <p className="error-message" role="alert">{error || saveError}</p>}
    <footer className="legal-acknowledgment-actions">
      {status?.required && <AsyncActionButton type="button" busy={busy} busyLabel="Saving Acknowledgment..." onClick={acknowledge}>Acknowledge Terms and Continue</AsyncActionButton>}
      {error && <button type="button" className="secondary-button" onClick={onRetry}>Try Again</button>}
      <button type="button" className="text-button" disabled={busy} onClick={onLogout}>Sign Out</button>
    </footer>
  </section>
}
