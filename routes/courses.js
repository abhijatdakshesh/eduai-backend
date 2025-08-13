const express = require('express');
const router = express.Router();
const coursesController = require('../controllers/coursesController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.get('/', coursesController.getCourses);
router.get('/departments', coursesController.getDepartments);
router.get('/:id', coursesController.getCourseById);

// Protected routes
router.use(authenticateToken);

// Get enrolled courses
router.get('/enrolled', coursesController.getEnrolledCourses);

// Enroll in course
router.post('/enroll/:courseId', coursesController.enrollInCourse);

// Drop course
router.delete('/enroll/:courseId', coursesController.dropCourse);

module.exports = router;
