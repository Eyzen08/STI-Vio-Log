import { Component } from 'react'

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) { return { error } }

  render() {
    if (!this.state.error) return this.props.children
    return <section className="route-state route-load-error" aria-labelledby="route-load-error-title">
      <span className="route-state-code" aria-hidden="true">!</span>
      <p className="eyebrow">Page update required</p>
      <h2 id="route-load-error-title">This page could not finish loading.</h2>
      <p>The portal may have been updated while this tab was open. Reload to use the latest version.</p>
      <button type="button" className="submit-btn" onClick={() => window.location.reload()}>Reload portal</button>
    </section>
  }
}

export default RouteErrorBoundary
