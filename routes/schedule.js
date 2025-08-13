const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// Get schedule for specific week
router.get('/week/:weekOffset', scheduleController.getScheduleByWeek);

// Get today's schedule
router.get('/today', scheduleController.getTodaySchedule);

// Get current week schedule
router.get('/current-week', scheduleController.getCurrentWeekSchedule);

module.exports = router;
