function RouteStatePage({ type, onGoHome }) {
  const isUnauthorized = type === 'unauthorized'

  return (
    <section className="route-state" aria-labelledby="route-state-title">
      <span className="route-state-code">{isUnauthorized ? '403' : '404'}</span>
      <p className="eyebrow">{isUnauthorized ? 'Access restricted' : 'Page not found'}</p>
      <h2 id="route-state-title">
        {isUnauthorized
          ? 'This page is not available for your role.'
          : 'The page you requested does not exist.'}
      </h2>
      <p>
        {isUnauthorized
          ? 'Your account is signed in, but it does not have permission to view this area.'
          : 'The address may be incorrect, or the page may have moved.'}
      </p>
      <button type="button" className="submit-btn" onClick={onGoHome}>
        Return to dashboard
      </button>
    </section>
  )
}

export default RouteStatePage
