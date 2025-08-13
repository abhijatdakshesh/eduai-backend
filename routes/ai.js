const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// Send message
router.post('/chat', aiController.sendMessage);

// Get chat history
router.get('/chat-history', aiController.getChatHistory);

// Clear chat history
router.delete('/chat-history', aiController.clearChatHistory);

// Get quick actions
router.get('/quick-actions', aiController.getQuickActions);

// Execute quick action
router.post('/quick-action/:actionId', aiController.executeQuickAction);

module.exports = router;
