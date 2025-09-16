const express = require('express');
const router = express.Router();
const communicationController = require('../controllers/communicationController');
const { authenticateToken, requireUserType } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// WhatsApp endpoints
router.post('/whatsapp/send', 
  requireUserType(['admin', 'teacher']), 
  communicationController.sendWhatsAppMessage
);

// AI Call endpoints
router.post('/ai-call/schedule', 
  requireUserType(['admin', 'teacher']), 
  communicationController.scheduleAICall
);

// Communication history and management
router.get('/students/:studentId/history', 
  requireUserType(['admin', 'teacher', 'parent']), 
  communicationController.getCommunicationHistory
);

router.get('/students/:studentId/stats', 
  requireUserType(['admin', 'teacher']), 
  communicationController.getCommunicationStats
);

// Webhook endpoints for status updates
router.put('/:communicationId/status', 
  communicationController.updateCommunicationStatus
);

module.exports = router;
