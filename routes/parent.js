const express = require('express');
const router = express.Router();
const { authenticateToken, requireUserType } = require('../middleware/auth');
const { ensureParentLinkedToStudent } = require('../middleware/parentMiddleware');
const parentController = require('../controllers/parentController');

router.use(authenticateToken, requireUserType(['parent']));

router.get('/dashboard', parentController.getDashboard);
router.get('/children', parentController.getChildren);
router.get('/announcements', parentController.getAnnouncements);
router.get('/children/:studentId/attendance', ensureParentLinkedToStudent, parentController.getChildAttendance);
router.get('/children/:studentId/attendance/summary', ensureParentLinkedToStudent, parentController.getChildAttendanceSummary);

module.exports = router;


