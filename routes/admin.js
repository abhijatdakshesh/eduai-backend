const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireUserType } = require('../middleware/auth');

// Apply authentication and admin role guard to all routes
router.use(authenticateToken);
router.use(requireUserType(['admin']));

// Dashboard Analytics
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/analytics/students', adminController.getStudentAnalytics);

// User Management
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Student Management
router.get('/students', adminController.getStudents);
router.post('/students', adminController.createStudent);

// Teacher Management
router.get('/teachers', adminController.getTeachers);
router.post('/teachers', adminController.createTeacher);

// Class Management
router.get('/classes', adminController.getClasses);
router.post('/classes', adminController.createClass);

// Attendance Management
router.get('/attendance/audit', adminController.getAttendanceAudit);

module.exports = router;
