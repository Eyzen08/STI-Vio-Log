const pool = require('../config/database');

const getAuditLogs = async (req, res) => {
  try {
    const { action, user_id, target_type, from_date, to_date, limit = 100 } = req.query;

    let query = `
      SELECT 
        id,
        user_id,
        action,
        target_type,
        target_id,
        description,
        ip_address,
        created_at
      FROM audit_logs
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      query += ` AND action = $${params.length + 1}`;
      params.push(action);
    }

    if (user_id) {
      query += ` AND user_id = $${params.length + 1}`;
      params.push(user_id);
    }

    if (target_type) {
      query += ` AND target_type = $${params.length + 1}`;
      params.push(target_type);
    }

    if (from_date) {
      query += ` AND created_at >= $${params.length + 1}`;
      params.push(from_date);
    }

    if (to_date) {
      query += ` AND created_at <= $${params.length + 1}`;
      params.push(to_date);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(parseInt(limit) || 100, 1000));

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
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users,
        MAX(created_at) as last_occurrence
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

const recordAuditLog = async (userId, action, targetType, targetId, description, ipAddress) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, description, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, targetType, targetId, description, ipAddress]
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
