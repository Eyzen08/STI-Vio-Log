import {useEffect,useState} from 'react'
import {totpSecondsRemaining} from '../lib/totpCountdown.js'
import OtpInput from './OtpInput.jsx'

export default function MfaChallenge({state,error,busy,onSubmit,onCancel,onContinue,draft,onDraftChange}){
 const [now,setNow]=useState(Date.now())
 const code=draft.code,recovery=draft.recovery
 const setCode=(value)=>onDraftChange({...draft,code:value})
 const setRecovery=(value)=>onDraftChange({...draft,recovery:value})
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),250);return()=>window.clearInterval(timer)},[])
 if(state.recoveryCodes)return <section className="login-form" aria-live="polite"><h3>Save your recovery codes</h3><p>Store these one-time codes in a password manager. They will not be shown again.</p><ul className="mfa-recovery-codes">{state.recoveryCodes.map(value=><li key={value}><code>{value}</code></li>)}</ul><button type="button" onClick={onContinue}>I saved these codes</button></section>
 const enrollment=state.mode==='enroll'
 const submit=e=>{e.preventDefault();onSubmit({code,recovery})}
 const period=Number(state.totp_period_seconds)||30
 const offset=Number(state.server_time_ms||0)-Number(state.client_time_ms||state.server_time_ms||0)
 const remaining=totpSecondsRemaining(now+offset,period)
 return <form className="login-form mfa-form" onSubmit={submit} aria-busy={busy}><h3>{enrollment?'Set up authenticator app':'Two-factor authentication'}</h3>{enrollment&&<><p>Add this account to your authenticator app, then enter the current six-digit code.</p><label>Setup key<input readOnly value={state.secret||''} aria-label="Authenticator setup key"/></label></>}{!enrollment&&<button type="button" className="secondary-button" onClick={()=>{setRecovery(!recovery);setCode('')}}>{recovery?'Use authenticator code':'Use a recovery code'}</button>}{!recovery&&<div className="totp-countdown" aria-label={`Authenticator code refreshes in ${remaining} seconds`}><div><span>Code refreshes in</span><strong>{remaining}s</strong></div><progress max={period} value={remaining}/></div>}{recovery?<label>Recovery code<input value={code} onChange={e=>setCode(e.target.value)} autoComplete="one-time-code" maxLength={32} required disabled={busy}/></label>:<OtpInput id="mfa-code" label="Six-digit code" value={code} onChange={setCode} disabled={busy} invalid={Boolean(error)} describedBy={error?'mfa-error':undefined} autoFocus/>}{error&&<p className="error-message" id="mfa-error" role="alert">{error}</p>}<button disabled={busy||(!recovery&&code.length!==6)}>{busy?'Verifying…':enrollment?'Enable MFA':'Verify'}</button><button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Cancel</button></form>
}
