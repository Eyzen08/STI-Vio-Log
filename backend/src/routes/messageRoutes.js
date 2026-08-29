const express = require('express');
const { listConversations, createConversation, getConversation, sendMessage, markConversationRead } = require('../controllers/messageController');
const router = express.Router();
router.get('/conversations', listConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:id', getConversation);
router.post('/conversations/:id/messages', sendMessage);
router.patch('/conversations/:id/read', markConversationRead);
module.exports = router;
