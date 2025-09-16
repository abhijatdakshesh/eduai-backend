const express = require('express');
const router = express.Router();

const { authenticateToken, requireUserType } = require('../middleware/auth');
const multer = require('multer');
const upload = multer();
const teacherController = require('../controllers/teacherController');
const announcementsController = require('../controllers/announcementsController');

// All routes require authenticated teacher
router.use(authenticateToken, requireUserType(['teacher']));

router.get('/classes', teacherController.getMyClasses);
router.get('/me', (req, res) => {
  res.json({ success: true, message: 'Profile', data: { user: { id: req.user.id, user_type: req.user.user_type } } });
});
router.get('/classes/:classId/students', teacherController.getClassRoster);
router.get('/classes/:classId/subjects', teacherController.getClassSubjects);
router.get('/classes/:classId/attendance', teacherController.getAttendanceForDate);
router.post('/classes/:classId/attendance', teacherController.saveAttendanceBulk);
router.get('/attendance/summary', teacherController.getAttendanceSummary);

// Optional CSV import/export
router.post('/classes/:classId/attendance/import', upload.single('file'), teacherController.importAttendanceCsv);
router.get('/classes/:classId/attendance/export', teacherController.exportAttendanceCsv);
router.get('/classes/:classId/attendance/summary', teacherController.getClassAttendanceSummary);

// Announcements (teacher)
router.post('/announcements', announcementsController.createTeacherAnnouncement);
router.get('/announcements', announcementsController.listTeacherAnnouncements);
router.patch('/announcements/:id', announcementsController.updateTeacherAnnouncement);

// =========================
// Teacher Attendance Flow Routes
// =========================

// Get departments available to teacher
router.get('/departments', teacherController.getDepartments);

// Get sections by department
router.get('/departments/:departmentId/sections', teacherController.getSectionsByDepartment);

// Get students by department, section, and time
router.get('/attendance/students', teacherController.getStudentsByDepartmentSectionTime);

// Save attendance with department/section/time context
router.post('/attendance/mark', teacherController.saveDepartmentSectionAttendance);

// Get existing attendance records for department/section/time
router.get('/attendance/records', teacherController.getDepartmentSectionAttendance);

module.exports = router;


