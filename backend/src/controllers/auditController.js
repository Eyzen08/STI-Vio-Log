const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');

const SECRET_PATTERN = /(bearer\s+[a-z0-9._~+\/-]+|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+|(?:password|password_hash|temporary_password|token|credential|google_sub|google_email)\s*[:=]\s*[^\s,;]+)/gi;
const sanitizeAuditDescription = (value) => value ? String(value).replace(SECRET_PATTERN, '[REDACTED]').slice(0, 1000) : null;
const parsePositiveInteger = (value, fallback, maximum) => { const parsed = Number.parseInt(value, 10); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback; };

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
      if (fromDate) add('al.created_at >= ?', fromDate);
      if (toDate) add('al.created_at <= ?', toDate);
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const countResult = await database.query(`SELECT COUNT(*)::int AS total FROM audit_logs al ${where}`, params);
      params.push(limit, (page - 1) * limit);
      const result = await database.query(
        `SELECT al.id, al.user_id, u.username AS actor_username, u.role AS actor_role,
                al.action, al.table_name, al.record_id, al.description, al.created_at
         FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
         ${where} ORDER BY al.created_at DESC, al.id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return res.json({
        success: true,
        audit_logs: result.rows.map((row) => ({
          id: row.id,
          user_id: row.user_id,
          actor_username: row.actor_username,
          actor_role: row.actor_role,
          action: row.action,
          table_name: row.table_name,
          record_id: row.record_id,
          description: sanitizeAuditDescription(row.description),
          created_at: row.created_at
        })),
        pagination: { page, limit, total: countResult.rows[0]?.total || 0 }
      });
    } catch (error) {
      return sendError(res, error.statusCode || 500, error.code || 'INTERNAL_ERROR', error.statusCode ? error.message : 'Failed to retrieve audit logs');
    }
  };
  const getAuditLogStats = async (_req, res) => {
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
