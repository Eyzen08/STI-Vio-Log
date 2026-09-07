export const MESSAGE_MAX_LENGTH = 1000
export const messageParticipant = (conversation, role) => role === 'STUDENT'
  ? { name:conversation.school_participant || conversation.department_name || 'Discipline Office', detail:conversation.assigned_department_id?'Department Head':'Discipline Office' }
  : { name:conversation.student_name || `${conversation.first_name||''} ${conversation.last_name||''}`.trim() || 'Student', detail:`${conversation.student_number || 'Student number unavailable'} · Student` }

export const conversationMatchesTab = (conversation, tab) => tab === 'UNREAD'
  ? Number(conversation.unread_count)>0
  : tab === 'CLOSED' ? conversation.status==='CLOSED' : true

export const messageDateLabel = (value, now = new Date()) => {
  const target = formatManilaDate(value, '')
  if (!target) return 'Unknown date'
  if (target === formatManilaDate(now, '')) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (target === formatManilaDate(yesterday, '')) return 'Yesterday'
  return target
}

export const groupMessagesByDate = (messages) => messages.reduce((groups,message)=>{
  const label=messageDateLabel(message.created_at)
  const last=groups.at(-1)
  if(last?.label===label)last.messages.push(message)
  else groups.push({label,messages:[message]})
  return groups
},[])
import { formatManilaDate } from './displayFormat.js'
