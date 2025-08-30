const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const teacherController = require('../controllers/teacherController');
const { authenticateToken, requireUserType } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// Get single class details - accessible by admin, teacher, and student
router.get('/:id', async (req, res) => {
  try {
    const { user_type } = req.user;
    
    // Route to appropriate controller based on user type
    if (user_type === 'admin') {
      return adminController.getClass(req, res);
    } else if (user_type === 'teacher') {
      return teacherController.getClass(req, res);
    } else {
      // For students and other users, return basic class info
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }
  } catch (error) {
    console.error('Class route error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve class details'
    });
  }
});

// Get class students - accessible by admin and teacher
router.get('/:id/students', async (req, res) => {
  try {
    const { user_type } = req.user;
    
    if (user_type === 'admin') {
      return adminController.getClassStudents(req, res);
    } else if (user_type === 'teacher') {
      return teacherController.getClassRoster(req, res);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }
  } catch (error) {
    console.error('Class students route error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve class students'
    });
  }
});

// Get class attendance - accessible by admin and teacher
router.get('/:id/attendance', async (req, res) => {
  try {
    const { user_type } = req.user;
    
    if (user_type === 'admin') {
      return adminController.getClassAttendance(req, res);
    } else if (user_type === 'teacher') {
      return teacherController.getClassAttendanceSummary(req, res);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }
  } catch (error) {
    console.error('Class attendance route error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve class attendance'
    });
  }
});

module.exports = router;
