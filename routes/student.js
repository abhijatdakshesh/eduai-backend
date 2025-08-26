const express = require('express');
const router = express.Router();
const { authenticateToken, requireUserType } = require('../middleware/auth');
const studentController = require('../controllers/studentController');
const announcementsController = require('../controllers/announcementsController');

router.use(authenticateToken, requireUserType(['student']));

router.get('/attendance', studentController.getMyAttendance);
router.get('/attendance/summary', studentController.getMyAttendanceSummary);

// Announcements (student)
router.get('/announcements', announcementsController.listStudentAnnouncements);
router.patch('/announcements/:id/read', announcementsController.markStudentAnnouncementRead);

module.exports = router;


