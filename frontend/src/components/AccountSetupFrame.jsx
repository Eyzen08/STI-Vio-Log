import OnboardingProgress from './OnboardingProgress.jsx'
import PolicyLinks from './PolicyLinks.jsx'

export default function AccountSetupFrame({ current, title, description, headingRef, busy, onLogout, onOpenPolicy, children }) {
  return <section className="account-setup-card" aria-labelledby="account-setup-title" aria-busy={busy}>
    {current && <OnboardingProgress current={current}/>}
    <header className="account-setup-heading">
      <h1 id="account-setup-title" ref={headingRef} tabIndex="-1">{title}</h1>
      <p>{description}</p>
    </header>
    {children}
    <footer className="account-setup-footer">
      <p>Need help? Contact the Discipline Office.</p>
      <div inert={busy?true:undefined}><PolicyLinks onOpenPolicy={onOpenPolicy}/><button type="button" className="text-button" onClick={onLogout} disabled={busy}>Sign out</button></div>
    </footer>
  </section>
}
