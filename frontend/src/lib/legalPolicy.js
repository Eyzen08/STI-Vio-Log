export const legalAccessState = (state, userId) => {
  const resolved = Boolean(userId && state?.userId === userId && typeof state.status?.required === 'boolean' && !state.error)
  return { ready: resolved && !state.status.required, required: resolved && state.status.required }
}

export const policyReturnPath = (search, fallback) => {
  const path = new URLSearchParams(search).get('return')
  if (!path?.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback
  const url = new URL(path, 'http://local.invalid')
  return url.pathname.startsWith('//') || ['/privacy', '/terms'].includes(url.pathname) ? fallback : `${url.pathname}${url.search}${url.hash}`
}
