import { publishedPolicies } from '../../../shared/legalPolicies.mjs'
import { formatManilaDate } from '../lib/displayFormat.js'

function PublicPolicyPage({ type, onNavigate, returnPath = '/login', policies = publishedPolicies }) {
  const policy = policies[type] || policies.privacy
  const policyPath = (path) => `${path}?return=${encodeURIComponent(returnPath)}`
  const navigate = (event, path) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); onNavigate(path)
  }

  return (
    <section className="public-policy-page">
      <header className="public-policy-header">
        <button type="button" className="public-policy-brand" onClick={() => onNavigate(returnPath)}>
          <span aria-hidden="true">STI</span>
          <strong>STI Vio-Log</strong>
        </button>
        <button type="button" className="public-policy-signin" onClick={() => onNavigate(returnPath)}>Return</button>
      </header>

      <article className="public-policy-card" aria-labelledby="public-policy-title">
        <div className="public-policy-intro">
          <p className="eyebrow">{policy.eyebrow}</p>
          <h1 id="public-policy-title">{policy.title}</h1>
          <p>{policy.summary}</p>
          <dl className="legal-document-versions">
            <div><dt>Version</dt><dd>{policy.version}</dd></div>
            <div><dt>Effective</dt><dd><time dateTime={policy.effectiveDate}>{formatManilaDate(policy.effectiveDate)}</time></dd></div>
            <div><dt>Last revised</dt><dd><time dateTime={policy.revisedDate}>{formatManilaDate(policy.revisedDate)}</time></dd></div>
          </dl>
          <nav className="policy-contents" aria-label="Document sections">
            {policy.sections.map(([heading], index) => <a key={heading} href={`#policy-section-${index}`}>{heading}</a>)}
          </nav>
        </div>

        <div className="public-policy-sections">
          {policy.sections.map(([heading, body], index) => (
            <section key={heading} id={`policy-section-${index}`}>
              <h2>{heading}</h2>
              <p>{body}</p>
            </section>
          ))}
          {policy.resources && <section>
            <h2>Institutional privacy information</h2>
            {policy.resources.map(({ label, url }) => <p key={url}><a href={url} target={url.startsWith('https:') ? '_blank' : undefined} rel="noopener noreferrer">{label}</a></p>)}
          </section>}
        </div>

        <footer className="public-policy-footer">
          <nav aria-label="Legal pages">
            <a href={policyPath('/privacy')} onClick={(event) => navigate(event, policyPath('/privacy'))}>Privacy Notice</a>
            <a href={policyPath('/terms')} onClick={(event) => navigate(event, policyPath('/terms'))}>Terms of Use</a>
          </nav>
          <button type="button" className="public-policy-primary" onClick={() => onNavigate(returnPath)}>Return</button>
        </footer>
      </article>
    </section>
  )
}

export default PublicPolicyPage
