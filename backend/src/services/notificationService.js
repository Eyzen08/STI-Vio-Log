const crypto = require('node:crypto')

const localDateTime = (value = new Date()) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
}).format(new Date(value))

const insertNotification = async (client, { userId, title, message, type, eventKey, category = 'SYSTEM', severity = 'INFO', resourceType = null, resourceId = null, linkPath = null, metadata = {} }) => {
  if (!client?.query || !userId || !title || !message || !eventKey) return null
  return (await client.query(
    `INSERT INTO notifications
       (user_id,title,message,notification_type,event_key,category,severity,resource_type,resource_id,link_path,metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING RETURNING id`,
    [userId, title, message, type || null, eventKey, category, severity, resourceType, resourceId, linkPath, JSON.stringify(metadata || {})]
  )).rows[0] || null
}

const notifyDisciplineSupportUse = async (client, { requestId, module }) => {
  if(!requestId)return []
  const recipients=(await client.query("SELECT id FROM users WHERE role='DISCIPLINE_ADMIN' AND is_active=TRUE")).rows
  const created=[]
  for(const recipient of recipients){
    const row=await insertNotification(client,{userId:recipient.id,title:'Temporary support access used',message:`Approved technical support access was used for ${String(module||'a protected module').slice(0,100)}.`,type:'SUPPORT_ACCESS_USED',eventKey:`support-access:${requestId}:used:${recipient.id}`,category:'SECURITY',severity:'WARNING',resourceType:'support_access_requests',resourceId:requestId,linkPath:'/admin/support-access'})
    if(row)created.push(row)
  }
  return created
}

const notifyStudent = async (client, studentId, notification) => {
  const student = (await client.query('SELECT user_id FROM students WHERE id = $1', [studentId])).rows[0]
  return student ? insertNotification(client, { ...notification, userId: student.user_id }) : null
}

const attendanceContext = async (client, { studentId, departmentId, supervisorId }) => (await client.query(
  `SELECT s.id AS student_id,s.student_number,s.first_name,s.last_name,d.department_name,
          COALESCE(sp.first_name,dh.first_name) AS officer_first_name,
          COALESCE(sp.last_name,dh.last_name) AS officer_last_name
   FROM students s CROSS JOIN departments d
   LEFT JOIN users supervisor ON supervisor.id=$3
   LEFT JOIN staff_profiles sp ON sp.user_id=supervisor.id
   LEFT JOIN department_heads dh ON dh.user_id=supervisor.id
   WHERE s.id=$1 AND d.id=$2`,
  [Number(studentId), Number(departmentId), supervisorId ? Number(supervisorId) : null]
)).rows[0]

const attendanceRecipients = async (client, departmentId) => (await client.query(
  `SELECT DISTINCT u.id FROM users u
   LEFT JOIN officer_department_assignments oda ON oda.officer_user_id=u.id
     AND oda.department_id=$1 AND oda.status='ACTIVE'
     AND oda.starts_at<=CURRENT_TIMESTAMP AND (oda.ends_at IS NULL OR oda.ends_at>CURRENT_TIMESTAMP)
   WHERE u.is_active=TRUE AND (u.role='DISCIPLINE_ADMIN' OR (u.role='DISCIPLINE_OFFICE' AND oda.id IS NOT NULL))`,
  [Number(departmentId)]
)).rows.map((row) => Number(row.id))

const notifyAttendanceStaff = async (client, { studentId, departmentId, supervisorId, sessionId, action, status = 'SUCCESS', occurredAt = new Date(), eventSuffix = '' }) => {
  const context = await attendanceContext(client, { studentId, departmentId, supervisorId })
  if (!context) return []
  const recipients = await attendanceRecipients(client, departmentId)
  const studentName = `${context.first_name || ''} ${context.last_name || ''}`.trim()
  const officerName = `${context.officer_first_name || ''} ${context.officer_last_name || ''}`.trim() || 'Not selected'
  const readableAction = String(action || 'ATTENDANCE').replaceAll('_', ' ')
  const message = `${studentName} (${context.student_number}) · ${readableAction} · ${context.department_name} · Supervising officer: ${officerName} · ${localDateTime(occurredAt)} · ${status}`
  const records = []
  for (const userId of recipients) {
    const row = await insertNotification(client, {
      userId, title: `Attendance ${readableAction.toLowerCase()}`, message,
      type: `ATTENDANCE_${String(action).toUpperCase()}`,
      eventKey: `attendance:${sessionId || 'attempt'}:${String(action).toLowerCase()}:${eventSuffix || 'event'}:${userId}`,
      category: 'ATTENDANCE', resourceType: 'community_service_sessions', resourceId: sessionId || null,
      linkPath: '/admin/community-service',
      metadata: { student_id: Number(studentId), department_id: Number(departmentId), supervising_officer_user_id: supervisorId ? Number(supervisorId) : null, status }
    })
    if (row) records.push({ user_id: userId, ...row })
  }
  return records
}

const notifyAttendanceFailure = async (client, { studentId, departmentId, supervisorId, action = 'SCAN_REJECTED', status = 'REJECTED' }) => {
  if (!studentId || !departmentId) return []
  return notifyAttendanceStaff(client, { studentId, departmentId, supervisorId, action, status, eventSuffix: crypto.randomUUID() })
}

const createOverdueAttendanceNotifications = async (client, thresholdHours = 8) => {
  const sessions = (await client.query(
    `SELECT css.id,css.time_in,css.department_id,css.supervising_officer_user_id,a.student_id
     FROM community_service_sessions css JOIN community_service_assignments a ON a.id=css.assignment_id
     WHERE css.time_out IS NULL AND css.status='ACTIVE'
       AND css.time_in<=CURRENT_TIMESTAMP-($1::text||' hours')::interval`,
    [Number(thresholdHours)]
  )).rows
  for (const session of sessions) await notifyAttendanceStaff(client, {
    studentId: session.student_id, departmentId: session.department_id,
    supervisorId: session.supervising_officer_user_id, sessionId: session.id,
    action: 'MISSING_TIME_OUT', status: `ACTIVE OVER ${thresholdHours} HOURS`, occurredAt: session.time_in, eventSuffix: 'overdue'
  })
  return sessions.length
}

module.exports = { insertNotification, notifyDisciplineSupportUse, notifyStudent, notifyAttendanceStaff, notifyAttendanceFailure, createOverdueAttendanceNotifications, localDateTime }
