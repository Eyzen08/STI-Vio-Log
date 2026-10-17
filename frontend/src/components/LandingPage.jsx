import { useEffect, useRef, useState } from 'react'
import LandingPreview from './LandingPreview.jsx'
import PortalIcon from './PortalIcon.jsx'
import usePublicMotion from '../lib/usePublicMotion.js'
import PublicMotionToggle from './PublicMotionToggle.jsx'
import logo from '../assets/sti-logo-web-transparent.png'
import campus from '../assets/sti-global-city-building-night.jpg'
import ribbon from '../assets/landing-ribbon.webp'
import '../styles/landing-page.css'
import '../styles/public-motion.css'

const FEATURES = [
  { icon: 'violations', number: '01', title: 'Understand your records.', copy: 'See incident details and their status, with a clear view of what needs your attention.' },
  { icon: 'clock', number: '02', title: 'Make progress visible.', copy: 'Follow assigned community service, recorded attendance, and credited hours.' },
  { icon: 'clearance', number: '03', title: 'Know what’s remaining.', copy: 'Check your clearance requirements and follow the Discipline Office’s review.' },
]
const STEPS = [
  ['Sign in securely', 'Use the credentials issued by the Discipline Office.'],
  ['Review your records', 'Get familiar with your details and assigned next steps.'],
  ['Track your service', 'Follow assigned hours and supervisor-recorded QR attendance.'],
  ['Follow your clearance', 'Check outstanding requirements and office review status.'],
]
const FAQS = [
  ['Who can access STI Vio-Log?', 'STI Global City students with an issued account, authorized Department Accounts, and Discipline Office staff can access their respective portals.'],
  ['How do I sign in for the first time?', 'Use your student number and the temporary password issued by the Discipline Office. Follow the account setup steps to create your password and complete your profile.'],
  ['Can I continue with Google?', 'Yes, after you complete account setup and bind your recorded Gmail. Use your issued student credentials first. Public account registration is not available.'],
  ['Where can I get help?', 'Contact the STI Global City Discipline Office for account access, record questions, or help with your assigned requirements.'],
]

export default function LandingPage({ accessState, onNavigate, onOpenPolicy }) {
  const rootRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [motionMode, toggleMotion] = usePublicMotion()
  const checking = accessState === 'restoring'
  const accountLabel = checking ? 'Checking Session…' : accessState === 'signed-in' ? 'Open My Portal' : 'Sign In'

  useEffect(() => {
    const root = rootRef.current
    let disposed = false
    let cleanup = () => {}
    if (motionMode === 'reduced') return undefined
    import('../lib/landingMotion.js').then(({ animateLanding }) => {
      if (!disposed) cleanup = animateLanding(root)
    }).catch(() => { /* Content remains visible if optional motion cannot load. */ })
    return () => { disposed = true; cleanup() }
  }, [motionMode])

  useEffect(() => {
    if (!menuOpen) return undefined
    const close = event => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        rootRef.current?.querySelector('.landing-menu-toggle')?.focus()
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [menuOpen])

  const navigate = (event, path) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(path)
  }
  const accountAction = className => checking
    ? <button className={className} type="button" disabled aria-busy="true">{accountLabel}</button>
    : <a className={className} data-magnetic href="/login" onClick={event => navigate(event, '/login')}>{accountLabel}<PortalIcon name="arrow-right" size={18} /></a>
  const motionControl = () => <PublicMotionToggle mode={motionMode} onToggle={toggleMotion} className="landing-motion-toggle" />

  return <div className="landing-page public-motion-surface" ref={rootRef} data-motion={motionMode}>
    <header className="landing-header">
      <a className="landing-brand" href="/" aria-label="STI Vio-Log home"><img src={logo} alt="STI Vio-Log" width="420" height="236" /><span>Global City</span></a>
      <nav id="landing-navigation" className={`landing-navigation${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
        <a href="#overview" onClick={() => setMenuOpen(false)}>Overview</a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How It Works</a><a href="#faqs" onClick={() => setMenuOpen(false)}>FAQs</a>
        {accountAction('landing-nav-action')}
      </nav>
      <div className="landing-header-controls">{motionControl()}<button className="landing-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="landing-navigation" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} onClick={() => setMenuOpen(value => !value)}><PortalIcon name={menuOpen ? 'close' : 'menu'} size={22} /></button></div>
    </header>

    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-copy">
        <div className="landing-eyebrow" data-hero-reveal><span />STI Global City <i /> Student accountability</div>
        <h1 id="landing-title" aria-label="Know your next step."><span aria-hidden="true" className="landing-title-line"><span data-hero-word>Know</span> <span data-hero-word>your</span></span><span aria-hidden="true" className="landing-title-line landing-title-accent"><span data-hero-word>next</span> <span data-hero-word>step.</span></span></h1>
        <p className="landing-hero-description" data-hero-reveal>View your records, track community service, and follow your clearance progress in one secure STI Global City portal.</p>
        <div className="landing-hero-actions" data-hero-reveal>{accountAction('landing-button landing-button-primary')}<a className="landing-button landing-button-secondary" href="#overview">Explore the System<PortalIcon name="arrow-down" size={18} /></a></div>
        {accessState === 'unavailable' && <p className="landing-session-note" role="status">Your session could not be verified. Open Sign In to retry or sign out.</p>}
        <div className="landing-hero-assurance" data-hero-reveal><PortalIcon name="lock" size={16} /><span>Your records stay private. This preview uses sample data.</span></div>
      </div>
      <div className="landing-hero-visual" data-hero-reveal>
        <div className="landing-ribbon-parallax"><img className="landing-ribbon" data-orbit src={ribbon} alt="" aria-hidden="true" width="1200" height="800" fetchPriority="high" /></div>
        <div className="landing-preview-parallax"><div className="landing-preview-float" data-float><div className="landing-preview-tilt" data-tilt="preview"><LandingPreview /></div></div></div>
        <div className="landing-visual-caption"><span className="landing-caption-line" /> A little clarity. A better way forward.</div>
      </div>
      <div className="landing-hero-footer"><a href="#overview"><span>Discover your portal</span><PortalIcon name="arrow-down" size={17} /></a><span>Discipline. Accountability. Progress.</span></div>
    </section>

    <section className="landing-section landing-overview" id="overview" aria-labelledby="overview-title" data-section-reveal>
      <div className="landing-section-heading"><span className="landing-eyebrow">Built around your next step</span><h2 id="overview-title">Less wondering.<br /><span>More understanding.</span></h2><p>A clearer connection between your records, your progress, and what comes next.</p></div>
      <div className="landing-feature-grid">{FEATURES.map(feature => <article key={feature.number} className="landing-feature" data-tilt="feature"><div className="landing-feature-top"><PortalIcon name={feature.icon} size={24} /><span>{feature.number}</span></div><h3>{feature.title}</h3><p>{feature.copy}</p></article>)}</div>
      <a className="landing-inline-link" href="#portal-preview">Try the interactive preview<PortalIcon name="arrow-right" size={18} /></a>
    </section>

    <section className="landing-section landing-how" id="how-it-works" aria-labelledby="how-title" data-section-reveal>
      <div className="landing-campus-panel"><img src={campus} alt="STI Global City campus at night" width="1200" height="825" loading="lazy" /><div><span className="landing-eyebrow">Connected to your campus</span><h2>One campus.<br />One clear path.</h2><span>STI Global City · Discipline Office</span></div></div>
      <div className="landing-steps-panel"><span className="landing-eyebrow">How it works</span><h2 id="how-title">From sign-in<br />to your next step.</h2><ol>{STEPS.map(([title, copy], index) => <li key={title}><span className="landing-step-number">0{index + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol></div>
    </section>

    <section className="landing-section landing-faqs" id="faqs" aria-labelledby="faqs-title" data-section-reveal><div className="landing-section-heading"><span className="landing-eyebrow">A little guidance</span><h2 id="faqs-title">Before you<br /><span>get started.</span></h2><p>Your first step should feel simple.</p></div><div className="landing-faq-list">{FAQS.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>

    <section className="landing-closing" aria-labelledby="closing-title" data-section-reveal><span className="landing-eyebrow">Your next step starts here</span><h2 id="closing-title">A clearer way<br />forward.</h2><p>Your records. Your progress. Your campus portal.</p>{accountAction('landing-button landing-button-primary')}</section>

    <footer className="landing-footer"><div><strong>STI Vio-Log</strong><span>© {new Date().getFullYear()} STI Global City</span></div><nav aria-label="Legal information"><a href="/privacy?return=%2F" onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpenPolicy('/privacy', '/') }}>Privacy Notice</a><a href="/terms?return=%2F" onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpenPolicy('/terms', '/') }}>Terms of Use</a></nav>{motionControl()}</footer>
  </div>
}
