const pool = require('../config/database')
const { assertAllowedFields, isPositiveId, parsePagination } = require('../utils/validators')
const { createOverdueAttendanceNotifications } = require('../services/notificationService')

const allowedCategories = new Set(['SYSTEM', 'SECURITY', 'ATTENDANCE', 'VIOLATIONS', 'COMMUNITY_SERVICE', 'CLEARANCE', 'MESSAGES'])

const getMyNotifications = async (req, res) => {
  try {
    assertAllowedFields(req.query, ['page', 'limit', 'state', 'category'])
    const { page, limit, offset } = parsePagination(req.query)
    const state = String(req.query.state || 'ALL').toUpperCase()
    const category = String(req.query.category || 'ALL').toUpperCase()
    if (!['ALL', 'READ', 'UNREAD'].includes(state)) return res.status(400).json({ success: false, message: 'State must be ALL, READ, or UNREAD' })
    if (category !== 'ALL' && !allowedCategories.has(category)) return res.status(400).json({ success: false, message: 'Invalid notification category' })
    if (['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE'].includes(req.user.role)) {
      await createOverdueAttendanceNotifications(pool).catch((error) => console.error('Overdue attendance notification check failed:', error.message))
    }
    const conditions = ['user_id = $1']
    const values = [req.user.id]
    if (state !== 'ALL') { values.push(state === 'READ'); conditions.push(`is_read=$${values.length}`) }
    if (category !== 'ALL') { values.push(category); conditions.push(`category=$${values.length}`) }
    const where = conditions.join(' AND ')
    const summary = (await pool.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE is_read=FALSE)::int AS unread FROM notifications WHERE ${where}`, values)).rows[0]
    values.push(limit, offset)
    const result = await pool.query(
      `SELECT id,title,message,notification_type,category,severity,resource_type,resource_id,link_path,metadata,is_read,read_at,acknowledged_at,created_at
       FROM notifications WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values
    )
    return res.json({ success: true, notifications: result.rows, summary, pagination: { page, limit, returned: result.rows.length } })
  } catch (error) {
    console.error('Get my notifications error:', error)
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Failed to get your notifications' })
  }
}

const markMyNotificationRead = async (req, res) => {
  try {
    assertAllowedFields(req.body, [])
    if (!isPositiveId(req.params.id)) return res.status(400).json({ success: false, message: 'A valid notification ID is required' })
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE,read_at=COALESCE(read_at,CURRENT_TIMESTAMP)
       WHERE id=$1 AND user_id=$2 RETURNING id,is_read,read_at`, [req.params.id, req.user.id]
    )
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Notification not found' })
    return res.json({ success: true, notification: result.rows[0] })
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Failed to update notification' })
  }
}

const acknowledgeMyNotification = async (req, res) => {
  try {
    assertAllowedFields(req.body, [])
    if (!isPositiveId(req.params.id)) return res.status(400).json({ success: false, message: 'A valid notification ID is required' })
    const result = await pool.query(
      `UPDATE notifications
       SET is_read=TRUE,read_at=COALESCE(read_at,CURRENT_TIMESTAMP),acknowledged_at=COALESCE(acknowledged_at,CURRENT_TIMESTAMP)
       WHERE id=$1 AND user_id=$2 AND category='SECURITY'
       RETURNING id,is_read,read_at,acknowledged_at`, [req.params.id, req.user.id]
    )
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Security notification not found' })
    return res.json({ success: true, notification: result.rows[0] })
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Failed to acknowledge notification' })
  }
}

const markAllMyNotificationsRead = async (req, res) => {
  try {
    assertAllowedFields(req.body, ['category'])
    const category = String(req.body.category || 'ALL').toUpperCase()
    if (category !== 'ALL' && !allowedCategories.has(category)) return res.status(400).json({ success: false, message: 'Invalid notification category' })
    const values = [req.user.id]
    const categoryFilter = category === 'ALL' ? '' : ` AND category=$${values.push(category)}`
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE,read_at=COALESCE(read_at,CURRENT_TIMESTAMP)
       WHERE user_id=$1 AND is_read=FALSE${categoryFilter} RETURNING id`, values
    )
    return res.json({ success: true, updated: result.rowCount })
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Failed to update notifications' })
  }
}

module.exports = { getMyNotifications, markMyNotificationRead, acknowledgeMyNotification, markAllMyNotificationsRead }
