const pool = require('../config/database');

const getAuditLogs = async (req, res) => {
  try {
    const {
      action,
      user_id,
      table_name,
      from_date,
      to_date,
      limit = 100
    } = req.query;

    let query = `
      SELECT
        al.id,
        al.user_id,
        u.role AS actor_role,
        al.action,
        al.table_name,
        al.record_id,
        al.description,
        al.ip_address,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1
    `;

    const params = [];

    if (action) {
      query += ` AND al.action = $${params.length + 1}`;
      params.push(action);
    }

    if (user_id) {
      query += ` AND al.user_id = $${params.length + 1}`;
      params.push(user_id);
    }

    if (table_name) {
      query += ` AND al.table_name = $${params.length + 1}`;
      params.push(table_name);
    }

    if (from_date) {
      query += ` AND al.created_at >= $${params.length + 1}`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND al.created_at <= $${params.length + 1}`;
      params.push(to_date);
    }

    const parsedLimit = Math.min(
      Math.max(parseInt(limit, 10) || 100, 1),
      1000
    );

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parsedLimit);

    const result = await pool.query(query, params);

    return res.json({
      success: true,
      total_records: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Get audit logs error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit logs'
    });
  }
};

const getAuditLogStats = async (req, res) => {
  try {
    const query = `
      SELECT
        action,
        COUNT(*)::int AS count,
        COUNT(DISTINCT user_id)::int AS unique_users,
        MAX(created_at) AS last_occurrence
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC
    `;

    const result = await pool.query(query);

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get audit log stats error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit log statistics'
    });
  }
};

const recordAuditLog = async (
  userId,
  action,
  tableName,
  recordId,
  description,
  ipAddress
) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs
        (user_id, action, table_name, record_id, description, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId || null,
        action,
        tableName || null,
        recordId || null,
        description || null,
        ipAddress || null
      ]
    );
  } catch (error) {
    console.error('Record audit log error:', error);
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogStats,
  recordAuditLog
};
