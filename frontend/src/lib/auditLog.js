export const AUDIT_PAGE_SIZE = 25

export const buildAuditQuery = (filters = {}, page = 1) => {
  const query = new URLSearchParams({ page: String(page), limit: String(AUDIT_PAGE_SIZE) })
  for (const [key, value] of Object.entries(filters)) {
    const clean = String(value || '').trim()
    if (clean) query.set(key, clean)
  }
  return query.toString()
}

export const formatAuditAction = (action = '') =>
  String(action).replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())

export const auditActorLabel = (entry = {}) =>
  entry.actor_username || (entry.user_id ? `User #${entry.user_id}` : 'System')
