const db = require('../config/database');

// Ensures the authenticated user is a parent
const requireParent = (req, res, next) => {
  if (req.user.user_type !== 'parent') {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  next();
};

// Ensures the parent is linked to the given studentId (UUID from students table)
const ensureParentLinkedToStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const parent = await db.query('SELECT id FROM parents WHERE user_id = $1', [req.user.id]);
    if (parent.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Parent profile not found' });
    }
    const parentId = parent.rows[0].id;

    // Check if student belongs to this parent using parent_students junction table
    const link = await db.query(
      'SELECT 1 FROM parent_students WHERE student_id = $1 AND parent_id = $2',
      [studentId, parentId]
    );
    if (link.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized for this student' });
    }
    next();
  } catch (err) {
    console.error('ensureParentLinkedToStudent error:', err);
    return res.status(500).json({ success: false, message: 'Authorization check failed' });
  }
};

module.exports = { requireParent, ensureParentLinkedToStudent };


