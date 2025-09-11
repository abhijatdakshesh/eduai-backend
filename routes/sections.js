const express = require('express');
const router = express.Router();
const sectionController = require('../controllers/sectionController');
const { authenticateToken } = require('../middleware/auth');
const { requireUserType } = require('../middleware/auth');

// =========================
// Section Management Routes
// =========================

// Create section (Admin only)
router.post('/', 
  authenticateToken, 
  requireUserType(['admin']), 
  sectionController.createSection
);

// Get all sections with filtering (Admin only)
router.get('/', 
  authenticateToken, 
  requireUserType(['admin']), 
  sectionController.getSections
);

// Get section by ID with details (Admin only)
router.get('/:id', 
  authenticateToken, 
  requireUserType(['admin']), 
  sectionController.getSection
);

// Update section (Admin only)
router.put('/:id', 
  authenticateToken, 
  requireUserType(['admin']), 
  sectionController.updateSection
);

// Delete section (Admin only)
router.delete('/:id', 
  authenticateToken, 
  requireUserType(['admin']), 
  sectionController.deleteSection
);

// =========================
// Section-Student Assignment Routes
// =========================

// Add students to section (Admin only)
router.post('/:id/students', 
  authenticateToken, 
  requireUserType(['admin']), 
  sectionController.addStudentsToSection
);

// Remove student from section (Admin only)
router.delete('/:id/students/:studentId', 
  authenticateToken, 
  requireUserType(['admin']), 
  sectionController.removeStudentFromSection
);

// Get available students for section (Admin only)
router.get('/:id/students/available', 
  authenticateToken, 
  requireUserType(['admin']), 
  sectionController.getAvailableStudentsForSection
);

// =========================
// Section-Teacher Assignment Routes
// =========================

// Assign teacher to section (Admin only)
router.post('/:id/teachers', 
  authenticateToken, 
  requireUserType(['admin']), 
  sectionController.assignTeacherToSection
);

// Remove teacher from section (Admin only)
router.delete('/:id/teachers/:teacherId', 
  authenticateToken, 
  requireUserType(['admin']), 
  sectionController.removeTeacherFromSection
);

// Get available teachers for section (Admin only)
router.get('/:id/teachers/available', 
  authenticateToken, 
  requireUserType(['admin']), 
  sectionController.getAvailableTeachersForSection
);

module.exports = router;
