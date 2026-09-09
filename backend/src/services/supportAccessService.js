const { PERMISSIONS } = require('../security/permissions');
const { insertNotification } = require('./notificationService');
const { recordSecurityEvent } = require('./securityEventService');

const READ_SCOPES = new Set([
  PERMISSIONS.STUDENT_BASIC_VIEW,
  PERMISSIONS.STUDENT_RESTRICTED_VIEW,
  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.PRIVATE_MESSAGES_VIEW,
  PERMISSIONS.GUARDIAN_CONTACT_VIEW,
  PERMISSIONS.OPERATIONAL_AUDIT_VIEW
]);
const clean = (value, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const uniqueScopes = (values) => [...new Set(Array.isArray(values) ? values.map((value) => clean(value, 100)) : [])];
const apiError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });

const expireSupportAccessGrants = async (database) => {
  const expired=(await database.query(`UPDATE support_access_requests SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP
    WHERE status='APPROVED' AND revoked_at IS NULL AND expires_at<=CURRENT_TIMESTAMP
    RETURNING id,requester_user_id,approver_user_id,affected_module,expires_at`)).rows;
  if(!expired.length)return 0;
  const disciplineAdmins=(await database.query("SELECT id FROM users WHERE role='DISCIPLINE_ADMIN' AND is_active=TRUE")).rows;
  for(const grant of expired){
    await database.query("INSERT INTO audit_logs(action,table_name,record_id,description)VALUES('SUPPORT_ACCESS_EXPIRED','support_access_requests',$1,'Temporary support access expired automatically')",[grant.id]);
    await insertNotification(database,{userId:grant.requester_user_id,title:'Support access expired',message:`Temporary read-only access to ${grant.affected_module} has expired.`,type:'SUPPORT_ACCESS_EXPIRED',eventKey:`support-access:${grant.id}:expired:requester`,category:'SECURITY',severity:'INFO',resourceType:'support_access_requests',resourceId:grant.id,linkPath:'/system/support-access'});
    for(const recipient of disciplineAdmins)await insertNotification(database,{userId:recipient.id,title:'Support access expired',message:`Approved technical access to ${grant.affected_module} has expired.`,type:'SUPPORT_ACCESS_EXPIRED',eventKey:`support-access:${grant.id}:expired:${recipient.id}`,category:'SECURITY',severity:'INFO',resourceType:'support_access_requests',resourceId:grant.id,linkPath:'/admin/support-access'});
    await recordSecurityEvent({actor:null,action:'SUPPORT_ACCESS_EXPIRED',targetType:'SUPPORT_ACCESS_REQUEST',targetId:grant.id,targetLabel:grant.affected_module,details:{expired_at:grant.expires_at},reason:'Configured duration elapsed',result:'SUCCESS',supportAccessRequestId:grant.id,database});
  }
  return expired.length;
};

const createSupportAccessService = ({ pool } = {}) => ({
  async request({ requesterId, reason, affectedModule, scopes, durationMinutes, ticketReference, readOnly = true, writeOperation, writeJustification }) {
    const requestedScopes = uniqueScopes(scopes);
    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration < 15 || duration > 480 || clean(reason).length < 10 || !clean(affectedModule, 100) || !requestedScopes.length || requestedScopes.some((scope) => !READ_SCOPES.has(scope))) {
      throw apiError(400, 'INVALID_SUPPORT_REQUEST', 'A valid reason, module, read scope, and duration from 15 to 480 minutes are required');
    }
    if (!readOnly) throw apiError(400, 'WRITE_SUPPORT_NOT_AVAILABLE', 'Temporary write access is not enabled; request read-only support access');
    const row = (await pool.query(
      `WITH created AS (
        INSERT INTO support_access_requests(requester_user_id,reason,affected_module,requested_scopes,requested_duration_minutes,ticket_reference,read_only)
        VALUES($1,$2,$3,$4::text[],$5,$6,TRUE) RETURNING *
      ), logged AS (
        INSERT INTO audit_logs(user_id,action,table_name,record_id,description)
        SELECT $1,'SUPPORT_ACCESS_REQUEST','support_access_requests',id,$7 FROM created
      ) SELECT * FROM created`,
      [Number(requesterId), clean(reason), clean(affectedModule, 100), requestedScopes, duration, clean(ticketReference, 100) || null, `Requested read-only support access for ${clean(affectedModule, 100)}`]
    )).rows[0];
    const recipients=(await pool.query("SELECT id FROM users WHERE role='DISCIPLINE_ADMIN' AND is_active=TRUE")).rows;
    for(const recipient of recipients) await insertNotification(pool,{userId:recipient.id,title:'Support access review required',message:`A System Administrator requested read-only access to ${clean(affectedModule,100)}.`,type:'SUPPORT_ACCESS_REQUEST',eventKey:`support-access:${row.id}:requested:${recipient.id}`,category:'SECURITY',resourceType:'support_access_requests',resourceId:row.id,linkPath:'/admin/support-access'});
    return row;
  },
  async decide({ approverId, requestId, approve, scopes, decisionReason }) {
    const approvedScopes = uniqueScopes(scopes);
    const why = clean(decisionReason);
    if (!why || (approve && (!approvedScopes.length || approvedScopes.some((scope) => !READ_SCOPES.has(scope))))) throw apiError(400, 'INVALID_SUPPORT_DECISION', 'A reason and valid approved scopes are required');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const request = (await client.query('SELECT * FROM support_access_requests WHERE id=$1 FOR UPDATE', [Number(requestId)])).rows[0];
      if (!request) throw apiError(404, 'SUPPORT_REQUEST_NOT_FOUND', 'Support request not found');
      if (request.status !== 'PENDING') throw apiError(409, 'SUPPORT_REQUEST_DECIDED', 'Support request has already been decided');
      if (Number(request.requester_user_id) === Number(approverId)) throw apiError(403, 'SEPARATION_OF_DUTIES_REQUIRED', 'A different Discipline Administrator must decide this request');
      if (approve && approvedScopes.some((scope) => !request.requested_scopes.includes(scope))) throw apiError(400, 'SCOPE_NOT_REQUESTED', 'Approved scopes must be a subset of requested scopes');
      const status = approve ? 'APPROVED' : 'REJECTED';
      const row = (await client.query(
        `UPDATE support_access_requests SET status=$2,approver_user_id=$3,approved_scopes=$4::text[],decision_reason=$5,
         approved_at=CASE WHEN $2='APPROVED' THEN CURRENT_TIMESTAMP ELSE NULL END,
         expires_at=CASE WHEN $2='APPROVED' THEN CURRENT_TIMESTAMP + (requested_duration_minutes * INTERVAL '1 minute') ELSE NULL END,
         updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
        [request.id, status, Number(approverId), approve ? approvedScopes : [], why]
      )).rows[0];
      await client.query("INSERT INTO audit_logs(user_id,action,table_name,record_id,description)VALUES($1,$2,'support_access_requests',$3,$4)", [Number(approverId), `SUPPORT_ACCESS_${status}`, request.id, `${status} support access request: ${why}`]);
      await insertNotification(client,{userId:request.requester_user_id,title:`Support access ${status.toLowerCase()}`,message:approve?'Your temporary read-only support access was approved.':'Your support-access request was rejected.',type:`SUPPORT_ACCESS_${status}`,eventKey:`support-access:${request.id}:${status.toLowerCase()}`,category:'SECURITY',resourceType:'support_access_requests',resourceId:request.id,linkPath:'/system/support-access'});
      await client.query('COMMIT');
      return row;
    } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; } finally { client.release(); }
  },
  async list({ actorId, actorRole }) {
    await expireSupportAccessGrants(pool);
    const params = [];
    const where = actorRole === 'SYSTEM_ADMIN' ? 'WHERE sar.requester_user_id=$1' : '';
    if (where) params.push(Number(actorId));
    const result = await pool.query(
      `SELECT sar.id,sar.requester_user_id,sar.approver_user_id,sar.reason,sar.affected_module,sar.requested_scopes,sar.approved_scopes,
       sar.requested_duration_minutes,sar.ticket_reference,sar.read_only,
       CASE WHEN sar.status='APPROVED' AND sar.expires_at<=CURRENT_TIMESTAMP THEN 'EXPIRED' ELSE sar.status::text END status,
       sar.decision_reason,sar.approved_at,sar.expires_at,sar.revoked_at,sar.created_at
       FROM support_access_requests sar ${where} ORDER BY sar.created_at DESC LIMIT 100`, params);
    return result.rows;
  },
  async revoke({ actorId, actorRole, requestId, reason }) {
    const why = clean(reason);
    if (!why) throw apiError(400, 'REVOCATION_REASON_REQUIRED', 'A revocation reason is required');
    const result = await pool.query(
      `WITH changed AS (
       UPDATE support_access_requests SET status='REVOKED',revoked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND status='APPROVED' AND ($3='DISCIPLINE_ADMIN' OR requester_user_id=$2) RETURNING id,requester_user_id
       ), logged AS (
       INSERT INTO audit_logs(user_id,action,table_name,record_id,description)
       SELECT $2,'SUPPORT_ACCESS_REVOKED','support_access_requests',id,$4 FROM changed)
       SELECT id FROM changed`, [Number(requestId), Number(actorId), actorRole, `Revoked support access: ${why}`]);
    if (!result.rowCount) throw apiError(404, 'ACTIVE_SUPPORT_GRANT_NOT_FOUND', 'Active support grant not found');
    await insertNotification(pool,{userId:result.rows[0].requester_user_id,title:'Support access revoked',message:'Temporary support access was revoked and is no longer active.',type:'SUPPORT_ACCESS_REVOKED',eventKey:`support-access:${result.rows[0].id}:revoked`,category:'SECURITY',resourceType:'support_access_requests',resourceId:result.rows[0].id,linkPath:'/system/support-access'});
    return { id: Number(result.rows[0].id), status: 'REVOKED' };
  }
});

module.exports = { READ_SCOPES, expireSupportAccessGrants, createSupportAccessService };
