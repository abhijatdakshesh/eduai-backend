const express = require('express');
const router = express.Router();

const { authenticateToken, requireUserType } = require('../middleware/auth');
const teacherController = require('../controllers/teacherController');

// All routes require authenticated teacher
router.use(authenticateToken, requireUserType(['teacher']));

router.get('/classes', teacherController.getMyClasses);
router.get('/classes/:classId/students', teacherController.getClassRoster);
router.get('/classes/:classId/attendance', teacherController.getAttendanceForDate);
router.post('/classes/:classId/attendance', teacherController.saveAttendanceBulk);
router.get('/attendance/summary', teacherController.getAttendanceSummary);

module.exports = router;


