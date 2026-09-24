const normalizeOrigin = (value, name) => {
  if (!value) throw new Error(`${name} is required for Vercel deployments`)
  const parsed = new URL(value)
  if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error(`${name} must be an HTTPS origin without a path, query, or fragment`)
  return parsed.origin
}

export const buildConfig = (env = process.env) => {
  const target = env.VERCEL_TARGET_ENV || env.VERCEL_ENV || 'development'
  const apiOrigin = normalizeOrigin(env.API_PROXY_ORIGIN, 'API_PROXY_ORIGIN')
  const productionOrigin = env.PRODUCTION_API_ORIGIN ? normalizeOrigin(env.PRODUCTION_API_ORIGIN, 'PRODUCTION_API_ORIGIN') : null
  if (target !== 'production' && productionOrigin && apiOrigin === productionOrigin) throw new Error('Non-production Vercel deployments must not proxy to the production API')
  const socketOrigin = apiOrigin.replace(/^https:/, 'wss:')
  const csp = `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: https://*.googleusercontent.com; font-src 'self'; connect-src 'self' ${apiOrigin} ${socketOrigin} https://accounts.google.com; frame-src https://accounts.google.com; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests`
  return {
    rewrites: [
      { source:'/api/:path*', destination:`${apiOrigin}/api/:path*` },
      { source:'/socket.io/:path*', destination:`${apiOrigin}/socket.io/:path*` },
      { source:'/(.*)', destination:'/index.html' }
    ],
    headers: [{ source:'/(.*)', headers:[
      { key:'Strict-Transport-Security', value:'max-age=63072000; includeSubDomains; preload' },
      { key:'X-Content-Type-Options', value:'nosniff' }, { key:'X-Frame-Options', value:'DENY' },
      { key:'Referrer-Policy', value:'strict-origin-when-cross-origin' },
      { key:'Permissions-Policy', value:'camera=(self), microphone=(), geolocation=()' },
      { key:'Content-Security-Policy', value:csp },
      { key:'Cross-Origin-Opener-Policy', value:'same-origin-allow-popups' },
      { key:'Cross-Origin-Resource-Policy', value:'same-site' }
    ] }]
  }
}

export const config = buildConfig()
