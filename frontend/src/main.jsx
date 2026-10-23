import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installMutationRequestGuard } from './lib/api.js'
import { installSearchInputGuard } from './lib/searchControls.js'

// Load the shared presentation layer as its own cached asset before rendering.
// This avoids a flash of legacy base styles while keeping each CSS bundle small.
await import('./styles/portal-system.css')
await import('./styles/portal-overrides.css')
await import('./styles/admin-dashboard.css')
await import('./styles/department-portal.css')
await import('./styles/account-setup.css')
await import('./styles/login-page.css')

installMutationRequestGuard(window)
installSearchInputGuard(document)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
