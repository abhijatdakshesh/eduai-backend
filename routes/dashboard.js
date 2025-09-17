const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// Base path returns stats for convenience
router.get('/', dashboardController.getDashboardStats);

// Get dashboard stats
router.get('/stats', dashboardController.getDashboardStats);

// Get quick actions
router.get('/quick-actions', dashboardController.getQuickActions);

module.exports = router;
