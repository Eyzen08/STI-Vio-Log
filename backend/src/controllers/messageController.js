const { avatarSql } = require('../services/avatarService');
const pool = require('../config/database');
const { assertAllowedFields, isPositiveId, parsePagination } = require('../utils/validators');
const { emitToRole, emitToUser } = require('../realtime');

const MESSAGE_LIMIT = 1000;
const fail = (res, error) => res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Messaging request failed' });
const httpError = (statusCode, message) => { const error = new Error(message); error.statusCode = statusCode; return error; };
const bad = (message) => { throw httpError(400, message); };
const notFound = () => { throw httpError(404, 'Conversation not found'); };
const cleanText = (value, label, maxLength) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) bad(`${label} must contain 1 to ${maxLength} valid characters`);
  return text;
};

const scope = (user, parameterIndex, alias = 'mc') => {
  if (user.role === 'STUDENT') return { sql: `EXISTS (SELECT 1 FROM students own_student WHERE own_student.id=${alias}.student_id AND own_student.user_id=$${parameterIndex})`, value: user.id };
  return { sql: 'TRUE', value: null };
};

const unreadSql = (userParameter) => `GREATEST((SELECT COUNT(*) FROM conversation_messages unread
  WHERE unread.conversation_id=mc.id AND unread.sender_user_id<>${userParameter}
    AND unread.created_at>COALESCE(cr.last_read_at,'-infinity')),
  CASE WHEN cr.marked_unread THEN 1 ELSE 0 END)::int`;

const unreadCount = async (user) => {
  const scoped = scope(user, 2);
  const params = [user.id];
  if (scoped.value !== null) params.push(scoped.value);
  const row = (await pool.query(`SELECT COALESCE(SUM(${unreadSql('$1')}),0)::int AS unread_total
    FROM message_conversations mc
    LEFT JOIN conversation_reads cr ON cr.conversation_id=mc.id AND cr.user_id=$1
    WHERE ${scoped.sql} AND NOT COALESCE(cr.is_deleted,FALSE) AND NOT COALESCE(cr.is_archived,FALSE)`, params)).rows[0];
  return Number(row?.unread_total || 0);
};

const assertConversation = async (user, id, executor = pool, lock = false) => {
  if (!isPositiveId(id)) bad('A valid conversation ID is required');
  const scoped = scope(user, 2);
  const params = [Number(id), user.id];
  const row = (await executor.query(
    `SELECT mc.*,${avatarSql('s.user_id')} AS student_avatar,s.student_number,s.first_name,s.last_name,d.department_name,
       COALESCE(cr.is_pinned,FALSE) AS is_pinned,COALESCE(cr.is_archived,FALSE) AS is_archived,
       ${unreadSql('$2')} AS unread_count
     FROM message_conversations mc
     JOIN students s ON s.id=mc.student_id
     LEFT JOIN departments d ON d.id=mc.assigned_department_id
     LEFT JOIN conversation_reads cr ON cr.conversation_id=mc.id AND cr.user_id=$2
     WHERE mc.id = $1 AND ${scoped.sql} AND NOT COALESCE(cr.is_deleted,FALSE)${lock ? ' FOR UPDATE OF mc' : ''}`,
    params
  )).rows[0];
  if (!row) notFound();
  return row;
};

const emitMessageChange = async (conversation, actorUserId = null) => {
  try {
    const student = (await pool.query('SELECT user_id FROM students WHERE id=$1', [conversation.student_id])).rows[0];
    const payload = { conversation_id: Number(conversation.id) };
    if (student?.user_id) emitToUser(student.user_id, 'messages:changed', payload);
    if (actorUserId) emitToUser(actorUserId, 'messages:changed', payload);
    emitToRole('DISCIPLINE_ADMIN', 'messages:changed', payload);
    emitToRole('DISCIPLINE_OFFICE', 'messages:changed', payload);
  } catch (error) {
    console.error('Realtime message notification failed:', error.message);
  }
};

const listConversations = async (req, res) => {
  try {
    const query = req.query || {};
    assertAllowedFields(query, ['search', 'status', 'page', 'limit', 'folder', 'unread']);
    const { page, limit, offset } = parsePagination(query, { defaultLimit: 25, maxLimit: 100 });
    const status = String(query.status || 'ALL').toUpperCase();
    if (!['ALL', 'OPEN', 'CLOSED'].includes(status)) bad('status must be ALL, OPEN, or CLOSED');
    const folder = String(query.folder || 'INBOX').toUpperCase();
    if (!['INBOX', 'ARCHIVED'].includes(folder)) bad('folder must be INBOX or ARCHIVED');
    if (query.unread !== undefined && !['true', 'false'].includes(query.unread)) bad('unread must be true or false');
    const search = String(query.search || '').trim();
    if (search.length > 100) bad('search must not exceed 100 characters');

    const params = [req.user.id];
    const scoped = scope(req.user, params.length + 1);
    if (scoped.value !== null) params.push(scoped.value);
    const filters = [scoped.sql, 'NOT COALESCE(cr.is_deleted,FALSE)', `COALESCE(cr.is_archived,FALSE)=${folder === 'ARCHIVED' ? 'TRUE' : 'FALSE'}`];
    if (query.unread === 'true') filters.push(`${unreadSql('$1')}>0`);
    if (status !== 'ALL') { params.push(status); filters.push(`mc.status=$${params.length}`); }
    if (search) { params.push(`%${search}%`); filters.push(`(mc.subject ILIKE $${params.length} OR s.student_number ILIKE $${params.length} OR CONCAT_WS(' ',s.first_name,s.last_name) ILIKE $${params.length} OR COALESCE(d.department_name,'Discipline Office') ILIKE $${params.length})`); }
    params.push(limit, offset);

    const rows = (await pool.query(
      `SELECT mc.id,mc.subject,mc.status,mc.created_at,mc.updated_at,mc.assigned_department_id,
        ${avatarSql('s.user_id')} AS student_avatar,s.student_number,CONCAT_WS(' ',s.first_name,s.last_name) AS student_name,
        COALESCE(d.department_name,'Discipline Office') AS school_participant,
        latest.message_text AS message_preview,latest.created_at AS latest_message_at,
        COALESCE(cr.is_pinned,FALSE) AS is_pinned,COALESCE(cr.is_archived,FALSE) AS is_archived,
        ${unreadSql('$1')} AS unread_count,COUNT(*) OVER()::int AS total_count
       FROM message_conversations mc
       JOIN students s ON s.id=mc.student_id
       LEFT JOIN departments d ON d.id=mc.assigned_department_id
       LEFT JOIN conversation_reads cr ON cr.conversation_id=mc.id AND cr.user_id=$1
       LEFT JOIN LATERAL (SELECT message_text,created_at FROM conversation_messages WHERE conversation_id=mc.id ORDER BY created_at DESC,id DESC LIMIT 1) latest ON TRUE
       WHERE ${filters.join(' AND ')}
       ORDER BY COALESCE(cr.is_pinned,FALSE) DESC,COALESCE(latest.created_at,mc.created_at) DESC,mc.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )).rows;
    const total = Number(rows[0]?.total_count || 0);
    const unreadTotal = await unreadCount(req.user);
    return res.json({ success:true, conversations:rows.map(({ total_count, unread_total, ...row }) => row), unread_total:unreadTotal, pagination:{ page, limit, total, pages:Math.ceil(total/limit) } });
  } catch (error) { return fail(res, error); }
};

const getUnreadCount = async (req, res) => {
  try {
    assertAllowedFields(req.query || {}, []);
    return res.json({ success:true, unread_total:await unreadCount(req.user) });
  } catch (error) { return fail(res, error); }
};

const listRecipients = async (req, res) => {
  try {
    const query = req.query || {};
    assertAllowedFields(query, ['search']);
    const search = String(query.search || '').trim();
    if (search.length > 100) bad('search must not exceed 100 characters');
    const pattern = `%${search}%`;
    if (req.user.role === 'STUDENT') {
      const recipients = [];
      if (!search || 'discipline office'.includes(search.toLowerCase())) recipients.push({ type:'DISCIPLINE_OFFICE', id:null, name:'Discipline Office', role:'DISCIPLINE_OFFICE' });
      return res.json({ success:true, recipients });
    }
    const params = [];
    const filters = [];
    if (search) { params.push(pattern); filters.push(`(s.student_number ILIKE $${params.length} OR CONCAT_WS(' ',s.first_name,s.last_name) ILIKE $${params.length})`); }
    const rows = (await pool.query(`SELECT ${avatarSql('s.user_id')} AS avatar,s.id,s.student_number,s.first_name,s.last_name FROM students s ${filters.length?`WHERE ${filters.join(' AND ')}`:''} ORDER BY s.last_name,s.first_name LIMIT 100`, params)).rows;
    return res.json({ success:true, recipients:rows.map((row) => ({ type:'STUDENT',avatar:row.avatar,id:Number(row.id),name:`${row.first_name} ${row.last_name}`.trim(),student_number:row.student_number,role:'STUDENT' })) });
  } catch (error) { return fail(res, error); }
};

const createConversation = async (req, res) => {
  const client = await pool.connect();
  try {
    const studentRole = req.user.role === 'STUDENT';
    assertAllowedFields(req.body, studentRole ? ['subject','message'] : ['student_id','subject','message']);
    const subject = cleanText(req.body.subject, 'Subject', 200);
    const message = cleanText(req.body.message, 'Message', MESSAGE_LIMIT);
    await client.query('BEGIN');
    let studentId;
    let assignedDepartmentId = null;
    if (studentRole) {
      studentId = (await client.query('SELECT id FROM students WHERE user_id=$1', [req.user.id])).rows[0]?.id;
    } else {
      if (!isPositiveId(req.body.student_id)) bad('A valid student is required');
      studentId = Number(req.body.student_id);
      if (!(await client.query('SELECT 1 FROM students WHERE id=$1', [studentId])).rows[0]) throw httpError(404, 'Student not found');
    }
    if (!studentId) throw httpError(404, 'Student record not found');
    const conversation = (await client.query(`INSERT INTO message_conversations(student_id,subject,created_by_user_id,assigned_department_id) VALUES($1,$2,$3,$4) RETURNING *`, [studentId,subject,req.user.id,assignedDepartmentId])).rows[0];
    await client.query(`INSERT INTO conversation_messages(conversation_id,sender_user_id,message_text) VALUES($1,$2,$3)`, [conversation.id,req.user.id,message]);
    await client.query(`INSERT INTO conversation_reads(conversation_id,user_id) VALUES($1,$2)`, [conversation.id,req.user.id]);
    await client.query('COMMIT');
    await emitMessageChange(conversation, req.user.id);
    return res.status(201).json({ success:true, conversation });
  } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} return fail(res,error); } finally { client.release(); }
};

const getConversation = async (req, res) => {
  try {
    const query = req.query || {};
    assertAllowedFields(query, ['page','limit']);
    const { page,limit,offset } = parsePagination(query,{ defaultLimit:50,maxLimit:100 });
    const conversation = await assertConversation(req.user,req.params.id);
    const rows = (await pool.query(
      `SELECT * FROM (SELECT ${avatarSql('u.id')} AS sender_avatar,cm.id,cm.message_text,cm.created_at,cm.sender_user_id=$1 AS sent_by_me,u.role AS sender_role,
        CASE WHEN u.role='STUDENT' THEN CONCAT_WS(' ',s.first_name,s.last_name)
             WHEN u.role='DEPARTMENT_HEAD' THEN COALESCE(CONCAT_WS(' ',dh.first_name,dh.last_name),d.department_name,u.username)
             ELSE COALESCE(CONCAT_WS(' ',sp.first_name,sp.last_name),u.username) END AS sender_name,
        COUNT(*) OVER()::int AS total_count
       FROM conversation_messages cm JOIN users u ON u.id=cm.sender_user_id
       LEFT JOIN students s ON s.user_id=u.id LEFT JOIN department_heads dh ON dh.user_id=u.id
       LEFT JOIN departments d ON d.id=dh.department_id LEFT JOIN staff_profiles sp ON sp.user_id=u.id
       WHERE cm.conversation_id=$2 ORDER BY cm.created_at DESC,cm.id DESC LIMIT $3 OFFSET $4) recent
       ORDER BY created_at,id`, [req.user.id,conversation.id,limit,offset])).rows;
    const total=Number(rows[0]?.total_count||0);
    return res.json({ success:true,conversation,messages:rows.map(({ total_count,...row })=>row),pagination:{page,limit,total,pages:Math.ceil(total/limit)} });
  } catch (error) { return fail(res,error); }
};

const sendMessage = async (req,res) => {
  let client;
  try {
    assertAllowedFields(req.body,['message']);
    const text=cleanText(req.body.message,'Message',MESSAGE_LIMIT);
    client=await pool.connect();
    await client.query('BEGIN');
    const conversation=await assertConversation(req.user,req.params.id,client,true);
    if(conversation.status!=='OPEN')throw httpError(409,'Conversation is closed');
    const message=(await client.query(`INSERT INTO conversation_messages(conversation_id,sender_user_id,message_text,created_at) VALUES($1,$2,$3,clock_timestamp()) RETURNING id,message_text,created_at`,[conversation.id,req.user.id,text])).rows[0];
    await client.query('UPDATE message_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=$1',[conversation.id]);
    await client.query('UPDATE conversation_reads SET is_archived=FALSE,is_deleted=FALSE WHERE conversation_id=$1',[conversation.id]);
    await client.query('COMMIT');
    await emitMessageChange(conversation,req.user.id);
    return res.status(201).json({success:true,message});
  } catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});return fail(res,error);}
  finally {client?.release();}
};

const markConversationRead = async (req,res) => {
  let client;
  try {
    if(!req.body || typeof req.body!=='object' || Array.isArray(req.body))bad('Request body must be an object');
    assertAllowedFields(req.body,['is_read']);
    const isRead = req.body.is_read === undefined ? true : req.body.is_read;
    if(typeof isRead !== 'boolean')bad('is_read must be a boolean');
    client=await pool.connect();
    await client.query('BEGIN');
    const conversation=await assertConversation(req.user,req.params.id,client,true);
    await client.query(`INSERT INTO conversation_reads(conversation_id,user_id,last_read_at,marked_unread)
      VALUES($1,$2,CASE WHEN $3 THEN clock_timestamp() ELSE '-infinity'::timestamptz END,NOT $3)
      ON CONFLICT(conversation_id,user_id) DO UPDATE SET
      last_read_at=CASE WHEN $3 THEN clock_timestamp() ELSE conversation_reads.last_read_at END,marked_unread=NOT $3`,[conversation.id,req.user.id,isRead]);
    await client.query('COMMIT');
    emitToUser(req.user.id,'messages:changed',{conversation_id:Number(conversation.id)});
    return res.json({success:true});
  }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});return fail(res,error);}
  finally{client?.release();}
};

const updateConversationPreferences = async (req,res) => {
  try {
    if(!req.body || typeof req.body!=='object' || Array.isArray(req.body))bad('Request body must be an object');
    assertAllowedFields(req.body,['is_pinned','is_archived']);
    const fields=Object.keys(req.body);
    if(!fields.length || fields.some(field=>typeof req.body[field]!=='boolean'))bad('Provide boolean conversation preferences');
    const conversation=await assertConversation(req.user,req.params.id);
    const values=[conversation.id,req.user.id,...fields.map(field=>req.body[field])];
    await pool.query(`INSERT INTO conversation_reads(conversation_id,user_id,last_read_at,${fields.join(',')})
      VALUES($1,$2,'-infinity',${fields.map((_,index)=>`$${index+3}`).join(',')})
      ON CONFLICT(conversation_id,user_id) DO UPDATE SET ${fields.map(field=>`${field}=EXCLUDED.${field}`).join(',')}`,values);
    emitToUser(req.user.id,'messages:changed',{conversation_id:Number(conversation.id)});
    return res.json({success:true});
  }catch(error){return fail(res,error);}
};

const deleteConversation = async (req,res) => {
  try {
    assertAllowedFields(req.body || {},[]);
    const conversation=await assertConversation(req.user,req.params.id);
    await pool.query(`INSERT INTO conversation_reads(conversation_id,user_id,last_read_at,is_deleted)
      VALUES($1,$2,'-infinity',TRUE) ON CONFLICT(conversation_id,user_id)
      DO UPDATE SET is_deleted=TRUE,is_pinned=FALSE,is_archived=FALSE,marked_unread=FALSE`,[conversation.id,req.user.id]);
    emitToUser(req.user.id,'messages:changed',{conversation_id:Number(conversation.id)});
    return res.json({success:true});
  }catch(error){return fail(res,error);}
};

const updateConversationStatus = async (req,res) => {
  try {
    if(!['DISCIPLINE_ADMIN','DISCIPLINE_OFFICE'].includes(req.user.role))throw httpError(403,'Only authorized office staff can update conversation status');
    assertAllowedFields(req.body,['status']);
    const status=String(req.body.status||'').toUpperCase();
    if(!['OPEN','CLOSED'].includes(status))bad('status must be OPEN or CLOSED');
    const conversation=await assertConversation(req.user,req.params.id);
    const updated=(await pool.query(`UPDATE message_conversations SET status=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *`,[status,conversation.id])).rows[0];
    await emitMessageChange(updated,req.user.id);
    return res.json({success:true,conversation:updated});
  }catch(error){return fail(res,error);}
};

module.exports={listConversations,getUnreadCount,listRecipients,createConversation,getConversation,sendMessage,markConversationRead,updateConversationPreferences,deleteConversation,updateConversationStatus,assertConversation};
