import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const reloadKey = 'sti_vio_log_chunk_reload'
  if (sessionStorage.getItem(reloadKey) === window.location.pathname) return
  sessionStorage.setItem(reloadKey, window.location.pathname)
  window.location.reload()
})

window.setTimeout(() => sessionStorage.removeItem('sti_vio_log_chunk_reload'), 10000)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
