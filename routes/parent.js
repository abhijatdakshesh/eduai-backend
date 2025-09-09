const express = require('express');
const router = express.Router();
const { authenticateToken, requireUserType } = require('../middleware/auth');
const { ensureParentLinkedToStudent } = require('../middleware/parentMiddleware');
const announcementsController = require('../controllers/announcementsController');
const parentController = require('../controllers/parentController');

router.use(authenticateToken, requireUserType(['parent']));

router.get('/dashboard', parentController.getDashboard);
router.get('/announcements', parentController.getAnnouncements);
router.get('/announcements/list', announcementsController.listParentAnnouncements);
router.patch('/announcements/:id/read', announcementsController.markParentAnnouncementRead);
router.get('/children/:studentId/info', ensureParentLinkedToStudent, parentController.getChildInfo);
router.get('/children/:studentId/attendance/summary', ensureParentLinkedToStudent, parentController.getChildAttendanceSummary);
router.get('/children/:studentId/attendance', ensureParentLinkedToStudent, parentController.getChildAttendance);
router.get('/children/:studentId/results', ensureParentLinkedToStudent, parentController.getChildResults);
router.get('/children', parentController.getChildren);

module.exports = router;


