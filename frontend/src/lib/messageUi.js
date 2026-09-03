export const MESSAGE_MAX_LENGTH = 1000
export const messageParticipant = (conversation, role) => role === 'STUDENT'
  ? { name:conversation.school_participant || conversation.department_name || 'Discipline Office', detail:conversation.assigned_department_id?'Department Head':'Discipline Office' }
  : { name:conversation.student_name || `${conversation.first_name||''} ${conversation.last_name||''}`.trim() || 'Student', detail:`${conversation.student_number || 'Student number unavailable'} · Student` }

export const conversationMatchesTab = (conversation, tab) => tab === 'UNREAD'
  ? Number(conversation.unread_count)>0
  : tab === 'CLOSED' ? conversation.status==='CLOSED' : true

export const messageDateLabel = (value, now = new Date()) => {
  const date=new Date(value)
  if(Number.isNaN(date.getTime()))return 'Unknown date'
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate())
  const target=new Date(date.getFullYear(),date.getMonth(),date.getDate())
  const days=Math.round((today-target)/86400000)
  if(days===0)return 'Today'
  if(days===1)return 'Yesterday'
  return date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:date.getFullYear()===now.getFullYear()?undefined:'numeric'})
}

export const groupMessagesByDate = (messages) => messages.reduce((groups,message)=>{
  const label=messageDateLabel(message.created_at)
  const last=groups.at(-1)
  if(last?.label===label)last.messages.push(message)
  else groups.push({label,messages:[message]})
  return groups
},[])
