const express = require('express');
const router = express.Router();

const { authenticateToken, requireUserType } = require('../middleware/auth');
const announcementsController = require('../controllers/announcementsController');

// All routes require authentication
router.use(authenticateToken);

// Teacher endpoints
router.post('/teacher', requireUserType(['teacher']), announcementsController.createTeacherAnnouncement);
router.get('/teacher', requireUserType(['teacher']), announcementsController.listTeacherAnnouncements);

// Student endpoints
router.get('/student', requireUserType(['student']), announcementsController.listStudentAnnouncements);

// Parent endpoints
router.get('/parent', requireUserType(['parent']), announcementsController.listParentAnnouncements);

module.exports = router;


