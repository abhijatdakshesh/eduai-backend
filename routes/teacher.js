const express = require('express');
const router = express.Router();

const { authenticateToken, requireUserType } = require('../middleware/auth');
const multer = require('multer');
const upload = multer();
const teacherController = require('../controllers/teacherController');

// All routes require authenticated teacher
router.use(authenticateToken, requireUserType(['teacher']));

router.get('/classes', teacherController.getMyClasses);
router.get('/classes/:classId/students', teacherController.getClassRoster);
router.get('/classes/:classId/attendance', teacherController.getAttendanceForDate);
router.post('/classes/:classId/attendance', teacherController.saveAttendanceBulk);
router.get('/attendance/summary', teacherController.getAttendanceSummary);

// Optional CSV import/export
router.post('/classes/:classId/attendance/import', upload.single('file'), teacherController.importAttendanceCsv);
router.get('/classes/:classId/attendance/export', teacherController.exportAttendanceCsv);
router.get('/classes/:classId/attendance/summary', teacherController.getClassAttendanceSummary);

module.exports = router;


