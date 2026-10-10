import { useState } from 'react'

export default function StudentCredentialDetails({ username, password, disabled }) {
  const [copyStatus,setCopyStatus]=useState('')
  const copy=async(value,label)=>{
    try {
      await navigator.clipboard.writeText(value)
      setCopyStatus(`${label} copied.`)
    }catch{setCopyStatus(`Could not copy. Select the ${label.toLowerCase()} above and copy it manually.`)}
  }
  return <>
    <dl className="credential-details">
      {[['Student Number',username],['Temporary password',password]].map(([label,value])=><div key={label}><dt>{label}</dt><dd><code>{value}</code></dd><button type="button" className="secondary-button" disabled={disabled} onClick={()=>copy(value,label)} aria-label={`Copy ${label.toLowerCase()}`}>Copy</button></div>)}
    </dl>
    {copyStatus&&<p role="status" className="setup-field-note">{copyStatus}</p>}
    <p className="credential-expiry">Expires 24 hours after issuance. Copy or send these credentials before closing; the password will not be shown again.</p>
    <ol className="credential-steps"><li>Sign in with the Student Number and temporary password.</li><li>Create a new password and acknowledge the Terms of Use when prompted.</li><li>Verify the recorded Gmail, then link that same Google account.</li><li>Complete academic, contact, and guardian information.</li></ol>
  </>
}
