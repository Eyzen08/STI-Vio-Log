import {useState} from 'react'

export default function MfaChallenge({state,error,busy,onSubmit,onCancel,onContinue}){
 const [code,setCode]=useState('');const [recovery,setRecovery]=useState(false)
 if(state.recoveryCodes)return <section className="login-form" aria-live="polite"><h3>Save your recovery codes</h3><p>Store these one-time codes in a password manager. They will not be shown again.</p><ul className="mfa-recovery-codes">{state.recoveryCodes.map(value=><li key={value}><code>{value}</code></li>)}</ul><button type="button" onClick={onContinue}>I saved these codes</button></section>
 const enrollment=state.mode==='enroll'
 const submit=e=>{e.preventDefault();onSubmit({code,recovery})}
 return <form className="login-form" onSubmit={submit} aria-busy={busy}><h3>{enrollment?'Set up authenticator app':'Two-factor authentication'}</h3>{enrollment&&<><p>Add this account to your authenticator app, then enter the current six-digit code.</p><label>Setup key<input readOnly value={state.secret||''} aria-label="Authenticator setup key"/></label></>}{!enrollment&&<button type="button" className="secondary-button" onClick={()=>{setRecovery(v=>!v);setCode('')}}>{recovery?'Use authenticator code':'Use a recovery code'}</button>}<label>{recovery?'Recovery code':'Six-digit code'}<input value={code} onChange={e=>setCode(e.target.value)} inputMode={recovery?'text':'numeric'} autoComplete="one-time-code" maxLength={recovery?32:6} required disabled={busy}/></label>{error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy}>{busy?'Verifying…':enrollment?'Enable MFA':'Verify'}</button><button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Cancel</button></form>
}
