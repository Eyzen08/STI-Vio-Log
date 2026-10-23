import { Component } from 'react'
import { routeFailure, recoveryDiagnostic } from '../lib/recoveryErrors.js'

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) { return { error } }

  componentDidCatch(error) {
    console.error('Page loading failed', recoveryDiagnostic(error, routeFailure(error).code))
  }

  render() {
    if (!this.state.error) return this.props.children
    const failure = routeFailure(this.state.error)
    return <section className="route-state route-load-error" aria-labelledby="route-load-error-title">
      <span className="route-state-code" aria-hidden="true">!</span>
      <p className="eyebrow">{failure.title}</p>
      <h2 id="route-load-error-title">This page could not finish loading.</h2>
      <p>{failure.message}</p>
      <button type="button" className="submit-btn" onClick={() => window.location.reload()}>Reload Portal</button>
    </section>
  }
}

export default RouteErrorBoundary
