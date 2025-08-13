const express = require('express');
const router = express.Router();
const { authenticateToken, requireUserType } = require('../middleware/auth');
const studentController = require('../controllers/studentController');

router.use(authenticateToken, requireUserType(['student']));

router.get('/attendance', studentController.getMyAttendance);
router.get('/attendance/summary', studentController.getMyAttendanceSummary);

module.exports = router;


