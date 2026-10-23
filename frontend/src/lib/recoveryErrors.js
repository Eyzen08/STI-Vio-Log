export const sessionFailure = (error, online = globalThis.navigator?.onLine !== false) => {
  if (!online) return { code: 'OFFLINE', title: 'You’re Offline', message: 'Reconnect to the internet. We’ll retry verifying your session when your connection returns.' }
  if (error?.code === 'SESSION_TIMEOUT') return { code: 'SESSION_TIMEOUT', title: 'Session Check Timed Out', message: 'The service took too long to respond. Please try again.' }
  if (error instanceof TypeError) return { code: 'NETWORK_ERROR', title: 'Connection Interrupted', message: 'We couldn’t reach the service. Check your connection and try again.' }
  if (error?.status >= 500 || error?.status === 429) return { code: 'SERVICE_UNAVAILABLE', title: 'Service Temporarily Unavailable', message: 'The service couldn’t verify your session right now. Please try again shortly.' }
  if (error?.code === 'INVALID_RESPONSE') return { code: 'INVALID_RESPONSE', title: 'Session Check Unavailable', message: 'The service returned an unexpected response. Please try again.' }
  return { code: 'SESSION_VERIFICATION_FAILED', title: 'Session Verification Failed', message: 'We couldn’t verify your session. Try again, or sign out and log in again.' }
}

export const routeFailure = (error) => {
  const moduleFailure = error?.name === 'ChunkLoadError' || /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .+ failed|Unable to preload CSS/i.test(error?.message || '')
  return moduleFailure
    ? { code: 'MODULE_LOAD_FAILED', title: 'Page Reload Required', message: 'A page file couldn’t load. The portal may have been updated, or your connection may have been interrupted. Reload to try again.' }
    : { code: 'PAGE_RENDER_FAILED', title: 'Page Could Not Load', message: 'Something went wrong while displaying this page. Reload to try again.' }
}

export const recoveryDiagnostic = (error, code) => ({
  code,
  status: Number.isInteger(error?.status) ? error.status : 0,
  ...(/^[a-zA-Z0-9:_-]{1,200}$/.test(error?.requestId || '') ? { requestId: error.requestId } : {})
})

export const retryOnReconnect = (target, retry) => {
  target.addEventListener('online', retry, { once: true })
  return () => target.removeEventListener('online', retry)
}
