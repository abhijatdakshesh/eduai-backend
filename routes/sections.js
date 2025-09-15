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

// Get all sections with filtering (Admin + Teacher)
router.get('/', 
  authenticateToken, 
  requireUserType(['admin', 'teacher']), 
  sectionController.getSections
);

// Get section by ID with details (Admin only)
router.get('/:id', 
  authenticateToken, 
  requireUserType(['admin']), 
  sectionController.getSection
);

// Get section students (Admin or Teacher with assignment)
router.get('/:id/students',
  authenticateToken,
  requireUserType(['admin','teacher']),
  async (req, res, next) => {
    if (req.user.user_type === 'admin') return sectionController.listSectionStudents(req, res);
    try {
      const db = require('../config/database');
      const { id } = req.params;
      const allowed = await db.query(`
        SELECT 1 FROM section_teachers st
        JOIN teachers t ON st.teacher_id = t.id
        WHERE st.section_id = $1 AND t.user_id = $2 AND st.status = 'active'`, [id, req.user.id]);
      if (allowed.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Not authorized for this section' });
      }
      return sectionController.listSectionStudents(req, res);
    } catch (e) { next(e); }
  }
);

// Get section teachers (Admin only)
router.get('/:id/teachers',
  authenticateToken,
  requireUserType(['admin']),
  sectionController.listSectionTeachers
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
