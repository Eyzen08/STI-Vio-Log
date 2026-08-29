const pool = require('../config/database');
const { assertAllowedFields, isPositiveId, parsePagination } = require('../utils/validators');

const getMyNotifications = async (req, res) => {
  try {
    assertAllowedFields(req.query, ['page', 'limit']);
    const { page, limit, offset } = parsePagination(req.query);
    const result = await pool.query(
      `SELECT id, title, message, notification_type, is_read, read_at, created_at
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

const markMyNotificationRead = async (req, res) => {
  try {
    assertAllowedFields(req.body, []);
    if (!isPositiveId(req.params.id)) return res.status(400).json({ success: false, message: 'A valid notification ID is required' });
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE id = $1 AND user_id = $2 RETURNING id, is_read, read_at`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Notification not found' });
    return res.json({ success: true, notification: result.rows[0] });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Failed to update notification' });
  }
};

module.exports = { getMyNotifications, markMyNotificationRead };
