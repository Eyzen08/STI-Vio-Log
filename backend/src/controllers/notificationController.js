const pool = require('../config/database');
const { assertAllowedFields, parsePagination } = require('../utils/validators');

const getMyNotifications = async (req, res) => {
  try {
    assertAllowedFields(req.query, ['page', 'limit']);
    const { page, limit, offset } = parsePagination(req.query);
    const result = await pool.query(
      `SELECT id, title, message, notification_type, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    return res.json({ success: true, notifications: result.rows, pagination: { page, limit, returned: result.rows.length } });
  } catch (error) {
    console.error('Get my notifications error:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Failed to get your notifications' });
  }
};

module.exports = { getMyNotifications };
