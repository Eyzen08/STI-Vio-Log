export default function PolicyLinks({ onOpenPolicy }) {
  const returnPath = window.location.pathname + window.location.search + window.location.hash
  const href = (path) => `${path}?return=${encodeURIComponent(returnPath)}`
  const open = (event, path) => {
    if (!onOpenPolicy || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenPolicy(path)
  }
  return <nav className="account-policy-links" aria-label="Privacy and terms">
    <a href={href('/privacy')} onClick={(event) => open(event, '/privacy')}>Privacy Notice</a>
    <a href={href('/terms')} onClick={(event) => open(event, '/terms')}>Terms of Use</a>
  </nav>
}
