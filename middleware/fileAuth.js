const db = require('../config/database');
const path = require('path');
const fs = require('fs');

// Helper function to check if teacher owns the class
async function assertTeacherOwnsClass(classId, userId) {
  const ownership = await db.query(
    `SELECT 1
     FROM classes c
     JOIN teachers t ON c.teacher_id = t.id
     WHERE c.id = $1 AND t.user_id = $2`,
    [classId, userId]
  );
  return ownership.rows.length > 0;
}

// Helper function to check if student is enrolled in class
async function assertStudentInClass(classId, userId) {
  const enrollment = await db.query(
    `SELECT 1
     FROM student_classes sc
     JOIN students s ON sc.student_id = s.id
     WHERE sc.class_id = $1 AND s.user_id = $2`,
    [classId, userId]
  );
  return enrollment.rows.length > 0;
}

// Middleware to authenticate file access for assignment files
const authenticateAssignmentFile = async (req, res, next) => {
  try {
    const filename = req.params.filename;
    
    // Find the assignment that contains this file
    const assignment = await db.query(
      `SELECT a.*, c.teacher_id, a.class_id
       FROM assignments a
       JOIN classes c ON a.class_id = c.id
       WHERE a.attachments::text LIKE $1`,
      [`%${filename}%`]
    );

    if (assignment.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const assignmentData = assignment.rows[0];

    // Check authorization based on user type
    if (req.user.user_type === 'teacher') {
      const ownsClass = await assertTeacherOwnsClass(assignmentData.class_id, req.user.id);
      if (!ownsClass) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this file'
        });
      }
    } else if (req.user.user_type === 'student') {
      const inClass = await assertStudentInClass(assignmentData.class_id, req.user.id);
      if (!inClass) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this file'
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // File is authorized, proceed to serve it
    next();
  } catch (error) {
    console.error('File authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to authenticate file access'
    });
  }
};

// Middleware to authenticate file access for submission files
const authenticateSubmissionFile = async (req, res, next) => {
  try {
    const filename = req.params.filename;
    
    // Find the submission that contains this file
    const submission = await db.query(
      `SELECT s.*, a.teacher_id, a.class_id
       FROM assignment_submissions s
       JOIN assignments a ON s.assignment_id = a.id
       JOIN classes c ON a.class_id = c.id
       WHERE s.attachments::text LIKE $1`,
      [`%${filename}%`]
    );

    if (submission.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const submissionData = submission.rows[0];

    // Check authorization based on user type
    if (req.user.user_type === 'teacher') {
      const ownsClass = await assertTeacherOwnsClass(submissionData.class_id, req.user.id);
      if (!ownsClass) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this file'
        });
      }
    } else if (req.user.user_type === 'student') {
      const inClass = await assertStudentInClass(submissionData.class_id, req.user.id);
      if (!inClass) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this file'
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // File is authorized, proceed to serve it
    next();
  } catch (error) {
    console.error('File authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to authenticate file access'
    });
  }
};

// Middleware to serve files with proper headers
const serveFile = (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads', req.params.type, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Set appropriate headers
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error reading file'
        });
      }
    });
    
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to serve file'
    });
  }
};

module.exports = {
  authenticateAssignmentFile,
  authenticateSubmissionFile,
  serveFile
};
