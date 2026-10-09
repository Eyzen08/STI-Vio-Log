import { formatDisplayLabel, formatManilaDateTime } from './displayFormat.js'
import { resolveRoute } from './routes.js'

export const notificationLabel = (value) => formatDisplayLabel(value || 'GENERAL')

export const notificationSummary = (items = []) => ({ total: items.length, unread: items.filter((item) => !item.is_read).length })

export const notificationDate = (value) => {
  return formatManilaDateTime(value, 'Date unavailable')
}

const targetFields = {
  violation_id: 'violationId', assignment_id: 'assignmentId', session_id: 'sessionId',
  conversation_id: 'conversationId', clearance_id: 'clearanceId', certificate_id: 'certificateId', student_id: 'studentId'
}
export const notificationRecordId = (value) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? String(Number(value)) : null

export const notificationTarget = (search = '') => {
  const params = new URLSearchParams(search)
  const target = { invalid: false }
  for (const [param, name] of Object.entries(targetFields)) {
    if (!params.has(param)) continue
    const id = notificationRecordId(params.get(param))
    if (!id || params.getAll(param).length !== 1) target.invalid = true
    else target[name] = id
  }
  const count = Object.keys(target).length - 1
  if (count > (target.assignmentId && target.sessionId ? 2 : 1)) target.invalid = true
  if (params.get('section') === 'security') target.section = 'security'
  return target
}

export const withoutNotificationTarget = (location) => {
  const url = new URL(location, 'https://portal.local')
  for (const param of [...Object.keys(targetFields), 'section', 'record_unavailable']) url.searchParams.delete(param)
  return `${url.pathname}${url.search}${url.hash}`
}

export const notificationDestination = (item, role) => {
  const prefix = role === 'STUDENT' ? '/student' : role === 'DEPARTMENT_HEAD' ? '/department' : '/admin'
  const routes = { VIOLATIONS: 'violations', COMMUNITY_SERVICE: 'community-service', ATTENDANCE: 'community-service', CLEARANCE: 'clearance', MESSAGES: 'messages', SECURITY: 'account-settings' }
  const resources = {
    violations: ['violations', 'violation_id'], community_service_assignments: ['community-service', 'assignment_id'],
    community_service_sessions: ['community-service', 'session_id'], message_conversations: ['messages', 'conversation_id'],
    student_clearance: ['clearance', 'clearance_id'], clearance_certificates: ['clearance', 'certificate_id'], students: ['students', 'student_id']
  }
  let link = null
  if (typeof item.link_path === 'string' && /^\/(?!\/)/.test(item.link_path) && !item.link_path.includes('\\')) {
    const candidate = new URL(item.link_path, 'https://portal.local')
    if (candidate.origin === 'https://portal.local') link = candidate
  }
  const category = item.category === 'SYSTEM' || !item.category
    ? String(item.notification_type || '').startsWith('SERVICE_') ? 'COMMUNITY_SERVICE' : String(item.notification_type || '').startsWith('VIOLATION_') ? 'VIOLATIONS' : item.category
    : item.category
  const resource = resources[item.resource_type]
  const section = resource?.[0] || routes[category] || link?.pathname.split('/').pop() || 'notifications'
  const path = `${prefix}/${section}`
  if (resolveRoute(path, role).status !== 'allowed') return `${prefix}/notifications?record_unavailable=1`
  const params = new URLSearchParams()
  if (section === 'account-settings' && category === 'SECURITY') params.set('section', 'security')
  else if (resource && notificationRecordId(item.resource_id)) {
    if (resource[1] === 'session_id' && notificationRecordId(item.metadata?.assignment_id)) params.set('assignment_id', notificationRecordId(item.metadata.assignment_id))
    if (resource[1] === 'certificate_id' && prefix === '/admin') params.set('panel', 'history')
    params.set(resource[1], notificationRecordId(item.resource_id))
  } else if (category === 'ATTENDANCE' && !item.resource_id && prefix === '/admin' && notificationRecordId(item.metadata?.student_id)) {
    return `/admin/students?student_id=${notificationRecordId(item.metadata.student_id)}`
  } else if (link && !resource) {
    const target = notificationTarget(link.search)
    const allowedParams = Object.values(resources).filter(([page]) => page === section).map(([, param]) => param)
    if (section === 'community-service') allowedParams.push('assignment_id')
    if (!target.invalid) for (const param of allowedParams) {
      if (target[targetFields[param]]) params.set(param, target[targetFields[param]])
    }
    if (params.has('certificate_id') && prefix === '/admin') params.set('panel', 'history')
  }
  if (!params.size) params.set('record_unavailable', '1')
  return `${path}?${params}`
}
