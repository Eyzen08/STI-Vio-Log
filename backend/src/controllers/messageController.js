const pool = require('../config/database');
const { assertAllowedFields, isPositiveId } = require('../utils/validators');
const { emitToRole, emitToUser } = require('../realtime');

const emitMessageChange = async (conversation) => {
  try {
    const student = (await pool.query('SELECT user_id FROM students WHERE id=$1', [conversation.student_id])).rows[0];
    const payload = { conversation_id: Number(conversation.id) };
    if (student?.user_id) emitToUser(student.user_id, 'messages:changed', payload);
    emitToRole('ADMIN', 'messages:changed', payload);
    emitToRole('DISCIPLINE_OFFICE', 'messages:changed', payload);
  } catch (error) {
    console.error('Realtime message notification failed:', error.message);
  }
};

const fail = (res, error) => res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Messaging request failed' });
const bad = (message) => { const error = new Error(message); error.statusCode = 400; throw error; };
const notFound = () => { const error = new Error('Conversation not found'); error.statusCode = 404; throw error; };

const scopeSql = (user, alias = 'mc') => user.role === 'STUDENT'
  ? `EXISTS (SELECT 1 FROM students own_student WHERE own_student.id = ${alias}.student_id AND own_student.user_id = $1)`
  : user.role === 'DEPARTMENT_HEAD'
    ? `EXISTS (SELECT 1 FROM community_service_assignments a JOIN community_service_sessions css ON css.assignment_id = a.id WHERE a.student_id = ${alias}.student_id AND css.department_id = $2)`
    : 'TRUE';
const scopeParams = (user) => user.role === 'DEPARTMENT_HEAD' ? [user.id, user.department_id] : [user.id];

const assertConversation = async (user, id, executor = pool) => {
  if (!isPositiveId(id)) bad('A valid conversation ID is required');
  const accessParams = user.role === 'STUDENT'
    ? [user.id]
    : user.role === 'DEPARTMENT_HEAD'
      ? [user.id, user.department_id]
      : [];
  const conversationIdParameter = accessParams.length + 1;
  const row = (await executor.query(
    `SELECT mc.* FROM message_conversations mc WHERE mc.id = $${conversationIdParameter} AND ${scopeSql(user)}`,
    [...accessParams, Number(id)]
  )).rows[0];
  if (!row) notFound();
  return row;
};

const listConversations = async (req, res) => {
  try {
    assertAllowedFields(req.query, []);
    const rows = (await pool.query(`SELECT mc.id, mc.subject, mc.status, mc.created_at, mc.updated_at,
      s.student_number, s.first_name, s.last_name,
      COUNT(cm.id) FILTER (WHERE cm.sender_user_id <> $1 AND cm.created_at > COALESCE(cr.last_read_at, '-infinity'))::int AS unread_count,
      MAX(cm.created_at) AS latest_message_at
      FROM message_conversations mc JOIN students s ON s.id = mc.student_id
      LEFT JOIN conversation_messages cm ON cm.conversation_id = mc.id
      LEFT JOIN conversation_reads cr ON cr.conversation_id = mc.id AND cr.user_id = $1
      WHERE ${scopeSql(req.user)} GROUP BY mc.id, s.id, cr.last_read_at ORDER BY mc.updated_at DESC, mc.id DESC`, scopeParams(req.user))).rows;
    return res.json({ success: true, conversations: rows });
  } catch (error) { return fail(res, error); }
};

const createConversation = async (req, res) => {
  const client = await pool.connect();
  try {
    assertAllowedFields(req.body, req.user.role === 'STUDENT' ? ['subject', 'message'] : ['student_id', 'subject', 'message']);
    const subject = String(req.body.subject || '').trim(); const message = String(req.body.message || '').trim();
    if (!subject || subject.length > 200 || !message || message.length > 2000) bad('A subject and message are required');
    await client.query('BEGIN');
    let studentId;
    if (req.user.role === 'STUDENT') studentId = (await client.query('SELECT id FROM students WHERE user_id = $1', [req.user.id])).rows[0]?.id;
    else {
      if (!isPositiveId(req.body.student_id)) bad('A valid student is required');
      studentId = Number(req.body.student_id);
      const visible = req.user.role === 'DEPARTMENT_HEAD'
        ? (await client.query(`SELECT 1 FROM community_service_assignments a JOIN community_service_sessions css ON css.assignment_id=a.id WHERE a.student_id=$1 AND css.department_id=$2 LIMIT 1`, [studentId, req.user.department_id])).rows[0]
        : (await client.query('SELECT 1 FROM students WHERE id = $1', [studentId])).rows[0];
      if (!visible) { const error = new Error('Student not found'); error.statusCode = 404; throw error; }
    }
    if (!studentId) { const error = new Error('Student record not found'); error.statusCode = 404; throw error; }
    const conversation = (await client.query(`INSERT INTO message_conversations (student_id, subject, created_by_user_id) VALUES ($1,$2,$3) RETURNING *`, [studentId, subject, req.user.id])).rows[0];
    await client.query(`INSERT INTO conversation_messages (conversation_id, sender_user_id, message_text) VALUES ($1,$2,$3)`, [conversation.id, req.user.id, message]);
    await client.query(`INSERT INTO conversation_reads (conversation_id,user_id) VALUES ($1,$2)`, [conversation.id, req.user.id]);
    await client.query('COMMIT');
    await emitMessageChange(conversation);
    return res.status(201).json({ success: true, conversation });
  } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} return fail(res, error); } finally { client.release(); }
};

const getConversation = async (req, res) => {
  try {
    const conversation = await assertConversation(req.user, req.params.id);
    const messages = (await pool.query(`SELECT cm.id, cm.message_text, cm.created_at, cm.sender_user_id = $1 AS sent_by_me, u.role AS sender_role, u.username AS sender_name FROM conversation_messages cm JOIN users u ON u.id=cm.sender_user_id WHERE cm.conversation_id=$2 ORDER BY cm.created_at, cm.id`, [req.user.id, conversation.id])).rows;
    return res.json({ success: true, conversation, messages });
  } catch (error) { return fail(res, error); }
};

const sendMessage = async (req, res) => {
  try {
    assertAllowedFields(req.body, ['message']); const text = String(req.body.message || '').trim();
    if (!text || text.length > 2000) bad('Message must contain 1 to 2000 characters');
    const conversation = await assertConversation(req.user, req.params.id);
    if (conversation.status !== 'OPEN') { const error = new Error('Conversation is closed'); error.statusCode = 409; throw error; }
    const message = (await pool.query(`INSERT INTO conversation_messages (conversation_id,sender_user_id,message_text) VALUES ($1,$2,$3) RETURNING id,message_text,created_at`, [conversation.id, req.user.id, text])).rows[0];
    await pool.query('UPDATE message_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=$1', [conversation.id]);
    await emitMessageChange(conversation);
    return res.status(201).json({ success: true, message });
  } catch (error) { return fail(res, error); }
};

const markConversationRead = async (req, res) => {
  try {
    assertAllowedFields(req.body, []); const conversation = await assertConversation(req.user, req.params.id);
    await pool.query(`INSERT INTO conversation_reads (conversation_id,user_id,last_read_at) VALUES ($1,$2,CURRENT_TIMESTAMP) ON CONFLICT (conversation_id,user_id) DO UPDATE SET last_read_at=CURRENT_TIMESTAMP`, [conversation.id, req.user.id]);
    return res.json({ success: true });
  } catch (error) { return fail(res, error); }
};

module.exports = { listConversations, createConversation, getConversation, sendMessage, markConversationRead };
