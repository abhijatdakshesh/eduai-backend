const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireUserType } = require('../middleware/auth');
const multer = require('multer');
const upload = multer();

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
router.patch('/students/:id', adminController.updateStudent);
router.delete('/students/:id', adminController.deleteStudent);
router.post('/students/import', upload.single('file'), adminController.importStudentsCsv);

// Teacher Management
router.get('/teachers', adminController.getTeachers);
router.post('/teachers', adminController.createTeacher);
router.patch('/teachers/:id', adminController.updateTeacher);
router.delete('/teachers/:id', adminController.deleteTeacher);

// Class Management
router.get('/classes', adminController.getClasses);
router.post('/classes', adminController.createClass);
router.get('/classes/:id', adminController.getClass);
router.get('/classes/:id/students', adminController.getClassStudents);
router.get('/classes/:id/students/available', adminController.getAvailableStudents);
router.get('/classes/:id/teachers', adminController.getClassTeachers);
router.patch('/classes/:id', adminController.updateClass);
router.put('/classes/:id', adminController.updateClass);
router.delete('/classes/:id', adminController.deleteClass);
router.post('/classes/:id/students', adminController.addStudentsToClassBulk);
router.delete('/classes/:id/students/:studentId', adminController.removeStudentFromClass);
router.post('/classes/:id/teachers', adminController.assignTeacherToClass);
router.delete('/classes/:id/teachers/:teacherId', adminController.unassignTeacherFromClass);
router.get('/classes/:id/attendance', adminController.getClassAttendance);

// Parent Management
router.get('/parents', adminController.getParents);
router.post('/parents', adminController.createParent);
router.patch('/parents/:id', adminController.updateParent);
router.delete('/parents/:id', adminController.deleteParent);
router.post('/parents/:parentId/children/:studentId', adminController.linkParentChild);
router.delete('/parents/:parentId/children/:studentId', adminController.unlinkParentChild);

// Attendance Management
router.get('/attendance/audit', adminController.getAttendanceAudit);

module.exports = router;
