const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.get('/', staffController.getStaff);
router.get('/departments', staffController.getStaffDepartments);
router.get('/:id', staffController.getStaffById);

// Protected routes
router.use(authenticateToken);

// Contact staff member
router.post('/:staffId/contact', staffController.contactStaff);

module.exports = router;
