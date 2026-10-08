const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');

const { sanitizeAuditDescription, auditDetails, enrichAuditRecords } = require('../services/auditPresentation');
const parsePositiveInteger = (value, fallback, maximum) => { const parsed = Number.parseInt(value, 10); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback; };
const calendarBoundary = (value, nextDay = false) => {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    const error = new Error('Enter valid calendar dates.'); error.statusCode = 400; error.code = 'VALIDATION_ERROR'; throw error;
  }
  if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
  return `${date.toISOString().slice(0, 10)}T00:00:00+08:00`;
};

const createAuditController = ({ database = pool } = {}) => {
  const getAuditLogs = async (req, res) => {
    try {
      assertAllowedFields(req.query, ['action', 'user_id', 'table_name', 'from_date', 'to_date', 'page', 'limit']);
      const { action, user_id: userId, table_name: tableName, from_date: fromDate, to_date: toDate } = req.query;
      const page = parsePositiveInteger(req.query.page, 1, 100000);
      const limit = parsePositiveInteger(req.query.limit, 25, 100);
      const clauses = [];
      const params = [];
      const add = (sql, value) => { params.push(value); clauses.push(sql.replace('?', `$${params.length}`)); };
      if (action) add('al.action = ?', String(action).trim().toUpperCase());
      if (userId) add('al.user_id = ?', userId);
      if (tableName) add('al.table_name = ?', String(tableName).trim());
      if (fromDate) add('al.created_at >= ?', calendarBoundary(fromDate));
      if (toDate) add('al.created_at < ?', calendarBoundary(toDate, true));
      if (fromDate && toDate && fromDate > toDate) { const error = new Error('From date must be on or before To date.'); error.statusCode = 400; error.code = 'VALIDATION_ERROR'; throw error; }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const countResult = await database.query(`SELECT COUNT(*)::int AS total FROM audit_logs al ${where}`, params);
      params.push(limit, (page - 1) * limit);
      const result = await database.query(
        `SELECT al.id, al.user_id, u.username AS actor_username, u.role AS actor_role,
                al.actor_role AS recorded_actor_role, al.target_label, al.previous_values, al.new_values, al.reason, al.result,
                COALESCE(NULLIF(concat_ws(' ', sp.first_name, sp.last_name), ''), NULLIF(concat_ws(' ', dh.first_name, dh.last_name), ''), NULLIF(concat_ws(' ', ap.first_name, ap.last_name), ''), NULLIF(concat_ws(' ', s.first_name, s.last_name), '')) AS actor_name,
                al.action, al.table_name, al.record_id, al.description, al.created_at
         FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
         LEFT JOIN staff_profiles sp ON sp.user_id=u.id LEFT JOIN department_heads dh ON dh.user_id=u.id
         LEFT JOIN admin_profiles ap ON ap.user_id=u.id LEFT JOIN students s ON s.user_id=u.id
         ${where} ORDER BY al.created_at DESC, al.id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      const options = await database.query('SELECT DISTINCT action, table_name FROM audit_logs ORDER BY action, table_name');
      const contexts = await enrichAuditRecords(database, result.rows);
      return res.json({
        success: true,
        audit_logs: result.rows.map((row, index) => ({
          id: row.id,
          user_id: row.user_id,
          actor_username: row.actor_username,
          actor_name: row.actor_name,
          actor_role: row.recorded_actor_role || auditDetails(row).actor_role || row.actor_role,
          action: row.action,
          table_name: row.table_name,
          record_id: row.record_id,
          description: sanitizeAuditDescription(row.description),
          record_context: contexts[index],
          details: auditDetails(row),
          created_at: row.created_at
        })),
        pagination: { page, limit, total: countResult.rows[0]?.total || 0 },
        filter_options: { actions: [...new Set(options.rows.map((row) => row.action).filter(Boolean))], record_types: [...new Set(options.rows.map((row) => row.table_name).filter(Boolean))].sort() }
      });
    } catch (error) {
      return sendError(res, error.statusCode || 500, error.code || 'INTERNAL_ERROR', error.statusCode ? error.message : 'Failed to retrieve audit logs');
    }
  };
  const getAuditLogStats = async (req, res) => {
    try {
      const result = await database.query('SELECT action, COUNT(*)::int AS count, MAX(created_at) AS last_occurrence FROM audit_logs GROUP BY action ORDER BY count DESC');
      return res.json({ success: true, data: result.rows });
    } catch (_error) { return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve audit log statistics'); }
  };
  return { getAuditLogs, getAuditLogStats };
};

const recordAuditLog = async (userId, action, tableName, recordId, description, ipAddress) => {
  try {
    await pool.query('INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address) VALUES ($1, $2, $3, $4, $5, $6)', [userId || null, action, tableName || null, recordId || null, description || null, ipAddress || null]);
  } catch (error) { console.error('Record audit log error:', error); }
};

module.exports = { createAuditController, sanitizeAuditDescription, recordAuditLog, ...createAuditController() };
