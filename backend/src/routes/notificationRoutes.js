const express = require('express')
const { getMyNotifications, markMyNotificationRead, acknowledgeMyNotification, markAllMyNotificationsRead } = require('../controllers/notificationController')

const router = express.Router()
router.get('/', getMyNotifications)
router.patch('/read-all', markAllMyNotificationsRead)
router.patch('/:id/acknowledge', acknowledgeMyNotification)
router.patch('/:id/read', markMyNotificationRead)

module.exports = router
