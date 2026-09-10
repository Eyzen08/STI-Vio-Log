const PUBLIC_METADATA = {
  '/login': ['Sign In', 'Access the secure STI Vio-Log portal for STI Global City.'],
  '/register': ['Create Student Account', 'Create and verify an STI Vio-Log student account.'],
  '/verify-email': ['Verify Email', 'Verify your STI Vio-Log student registration.'],
  '/forgot-password': ['Forgot Password', 'Request secure recovery for your STI Vio-Log account.'],
  '/reset-password/verify': ['Verify Recovery Code', 'Verify your STI Vio-Log password recovery request.'],
  '/reset-password/new': ['Set New Password', 'Choose a new password for your STI Vio-Log account.'],
  '/privacy': ['Privacy Policy', 'Learn how STI Vio-Log handles school account and student record information.'],
  '/terms': ['Terms of Use', 'Review the acceptable-use terms for the STI Vio-Log school portal.'],
}

export const metadataForRoute = (path, routeLabel) => {
  const [page, description] = PUBLIC_METADATA[path] || [routeLabel || 'Page Not Found', 'STI Vio-Log student discipline and community service portal.']
  return { title: `${page} | STI Vio-Log`, description, robots: PUBLIC_METADATA[path] ? 'index, follow' : 'noindex, nofollow' }
}

export const applyPageMetadata = ({ title, description, robots }) => {
  document.title = title
  const update = (selector, value) => document.head.querySelector(selector)?.setAttribute('content', value)
  update('meta[name="description"]', description)
  update('meta[name="robots"]', robots)
  update('meta[property="og:title"]', title)
  update('meta[property="og:description"]', description)
  update('meta[name="twitter:title"]', title)
  update('meta[name="twitter:description"]', description)
}
