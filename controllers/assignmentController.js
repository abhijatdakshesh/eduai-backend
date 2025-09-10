const db = require('../config/database');
const { formatFileInfo, getFileUrl } = require('../middleware/upload');

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

module.exports = {
  // Teacher endpoints
  async createAssignment(req, res) {
    try {
      const { classId, title, description, instructions, dueDate, maxPoints, assignmentType } = req.body;
      
      // Validate required fields
      if (!classId || !title) {
        return res.status(400).json({
          success: false,
          message: 'Class ID and title are required'
        });
      }

      // Check if teacher owns the class
      const ownsClass = await assertTeacherOwnsClass(classId, req.user.id);
      if (!ownsClass) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to create assignments for this class'
        });
      }

      // Get teacher ID
      const teacher = await db.query(
        'SELECT id FROM teachers WHERE user_id = $1',
        [req.user.id]
      );

      if (teacher.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Teacher profile not found'
        });
      }

      const teacherId = teacher.rows[0].id;

      // Format file attachments if any
      let attachments = [];
      if (req.files && req.files.length > 0) {
        attachments = formatFileInfo(req.files).map(file => ({
          ...file,
          url: getFileUrl(req, file.path)
        }));
      }

      // Create assignment
      const assignment = await db.query(
        `INSERT INTO assignments (title, description, instructions, class_id, teacher_id, due_date, max_points, assignment_type, attachments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [title, description, instructions, classId, teacherId, dueDate, maxPoints || 100, assignmentType || 'homework', JSON.stringify(attachments)]
      );

      res.status(201).json({
        success: true,
        message: 'Assignment created successfully',
        data: { assignment: assignment.rows[0] }
      });

    } catch (error) {
      console.error('Create assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create assignment'
      });
    }
  },

  async getTeacherAssignments(req, res) {
    try {
      const { classId } = req.query;

      // Get teacher ID
      const teacher = await db.query(
        'SELECT id FROM teachers WHERE user_id = $1',
        [req.user.id]
      );

      if (teacher.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Teacher profile not found',
          data: { assignments: [] }
        });
      }

      const teacherId = teacher.rows[0].id;

      let query = `
        SELECT a.*, c.name as class_name, c.grade_level,
               COUNT(s.id) as submission_count,
               COUNT(CASE WHEN s.status = 'submitted' THEN 1 END) as submitted_count
        FROM assignments a
        JOIN classes c ON a.class_id = c.id
        LEFT JOIN assignment_submissions s ON a.id = s.assignment_id
        WHERE a.teacher_id = $1
      `;
      
      let params = [teacherId];

      if (classId) {
        // Check if teacher owns this class
        const ownsClass = await assertTeacherOwnsClass(classId, req.user.id);
        if (!ownsClass) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to view assignments for this class'
          });
        }
        query += ' AND a.class_id = $2';
        params.push(classId);
      }

      query += ' GROUP BY a.id, c.name, c.grade_level ORDER BY a.created_at DESC';

      const assignments = await db.query(query, params);

      res.json({
        success: true,
        message: 'Assignments retrieved successfully',
        data: { assignments: assignments.rows }
      });

    } catch (error) {
      console.error('Get teacher assignments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assignments'
      });
    }
  },

  async getAssignmentDetails(req, res) {
    try {
      const { assignmentId } = req.params;

      // Get assignment with class info
      const assignment = await db.query(
        `SELECT a.*, c.name as class_name, c.grade_level,
                t.teacher_id, u.first_name as teacher_first_name, u.last_name as teacher_last_name
         FROM assignments a
         JOIN classes c ON a.class_id = c.id
         JOIN teachers t ON a.teacher_id = t.id
         JOIN users u ON t.user_id = u.id
         WHERE a.id = $1`,
        [assignmentId]
      );

      if (assignment.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      const assignmentData = assignment.rows[0];

      // Check if user has access to this assignment
      if (req.user.user_type === 'teacher') {
        const ownsClass = await assertTeacherOwnsClass(assignmentData.class_id, req.user.id);
        if (!ownsClass) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to view this assignment'
          });
        }
      } else if (req.user.user_type === 'student') {
        const inClass = await assertStudentInClass(assignmentData.class_id, req.user.id);
        if (!inClass) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to view this assignment'
          });
        }
      }

      // Get submissions based on user type
      let submissions = [];
      if (req.user.user_type === 'teacher') {
        // Teacher sees all submissions for the assignment
        const submissionData = await db.query(
          `SELECT s.*, st.student_id, u.first_name, u.last_name
           FROM assignment_submissions s
           JOIN students st ON s.student_id = st.id
           JOIN users u ON st.user_id = u.id
           WHERE s.assignment_id = $1
           ORDER BY s.submitted_at DESC`,
          [assignmentId]
        );
        submissions = submissionData.rows;
      } else if (req.user.user_type === 'student') {
        // Student sees only their own submission
        const student = await db.query(
          'SELECT id FROM students WHERE user_id = $1',
          [req.user.id]
        );
        
        if (student.rows.length > 0) {
          const studentId = student.rows[0].id;
          const submissionData = await db.query(
            `SELECT s.*, st.student_id, u.first_name, u.last_name
             FROM assignment_submissions s
             JOIN students st ON s.student_id = st.id
             JOIN users u ON st.user_id = u.id
             WHERE s.assignment_id = $1 AND s.student_id = $2
             ORDER BY s.submitted_at DESC`,
            [assignmentId, studentId]
          );
          submissions = submissionData.rows;
        }
      }

      res.json({
        success: true,
        message: 'Assignment details retrieved successfully',
        data: {
          assignment: assignmentData,
          submissions: submissions
        }
      });

    } catch (error) {
      console.error('Get assignment details error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assignment details'
      });
    }
  },

  async updateAssignment(req, res) {
    try {
      const { assignmentId } = req.params;
      const { title, description, instructions, dueDate, maxPoints, assignmentType, status, attachments } = req.body;

      // Get assignment
      const assignment = await db.query(
        'SELECT * FROM assignments WHERE id = $1',
        [assignmentId]
      );

      if (assignment.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // Check if teacher owns the class
      const ownsClass = await assertTeacherOwnsClass(assignment.rows[0].class_id, req.user.id);
      if (!ownsClass) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this assignment'
        });
      }

      // Update assignment
      const updatedAssignment = await db.query(
        `UPDATE assignments 
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             instructions = COALESCE($3, instructions),
             due_date = COALESCE($4, due_date),
             max_points = COALESCE($5, max_points),
             assignment_type = COALESCE($6, assignment_type),
             status = COALESCE($7, status),
             attachments = COALESCE($8, attachments),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING *`,
        [title, description, instructions, dueDate, maxPoints, assignmentType, status, JSON.stringify(attachments), assignmentId]
      );

      res.json({
        success: true,
        message: 'Assignment updated successfully',
        data: { assignment: updatedAssignment.rows[0] }
      });

    } catch (error) {
      console.error('Update assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update assignment'
      });
    }
  },

  async deleteAssignment(req, res) {
    try {
      const { assignmentId } = req.params;

      // Get assignment
      const assignment = await db.query(
        'SELECT * FROM assignments WHERE id = $1',
        [assignmentId]
      );

      if (assignment.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // Check if teacher owns the class
      const ownsClass = await assertTeacherOwnsClass(assignment.rows[0].class_id, req.user.id);
      if (!ownsClass) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete this assignment'
        });
      }

      // Delete assignment (cascade will handle submissions)
      await db.query('DELETE FROM assignments WHERE id = $1', [assignmentId]);

      res.json({
        success: true,
        message: 'Assignment deleted successfully'
      });

    } catch (error) {
      console.error('Delete assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete assignment'
      });
    }
  },

  // Student endpoints
  async getStudentAssignments(req, res) {
    try {
      // Get student ID
      const student = await db.query(
        'SELECT id FROM students WHERE user_id = $1',
        [req.user.id]
      );

      if (student.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Student profile not found',
          data: { assignments: [] }
        });
      }

      const studentId = student.rows[0].id;

      // Get assignments for classes the student is enrolled in
      const assignments = await db.query(
        `SELECT a.*, c.name as class_name, c.grade_level,
                t.teacher_id, u.first_name as teacher_first_name, u.last_name as teacher_last_name,
                s.id as submission_id, s.submitted_at, s.grade, s.status as submission_status
         FROM assignments a
         JOIN classes c ON a.class_id = c.id
         JOIN teachers t ON a.teacher_id = t.id
         JOIN users u ON t.user_id = u.id
         JOIN student_classes sc ON a.class_id = sc.class_id
         LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.student_id = $1
         WHERE sc.student_id = $1 AND a.status = 'active'
         ORDER BY a.due_date ASC, a.created_at DESC`,
        [studentId]
      );

      res.json({
        success: true,
        message: 'Student assignments retrieved successfully',
        data: { assignments: assignments.rows }
      });

    } catch (error) {
      console.error('Get student assignments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve student assignments'
      });
    }
  },

  async submitAssignment(req, res) {
    try {
      const { assignmentId } = req.params;
      const { submissionText } = req.body;

      // Get student ID
      const student = await db.query(
        'SELECT id FROM students WHERE user_id = $1',
        [req.user.id]
      );

      if (student.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Student profile not found'
        });
      }

      const studentId = student.rows[0].id;

      // Get assignment
      const assignment = await db.query(
        'SELECT * FROM assignments WHERE id = $1',
        [assignmentId]
      );

      if (assignment.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // Check if student is enrolled in the class
      const inClass = await assertStudentInClass(assignment.rows[0].class_id, req.user.id);
      if (!inClass) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to submit this assignment'
        });
      }

      // Check if assignment is still active
      if (assignment.rows[0].status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Assignment is no longer accepting submissions'
        });
      }

      // Check if already submitted
      const existingSubmission = await db.query(
        'SELECT id FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2',
        [assignmentId, studentId]
      );

      if (existingSubmission.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Assignment already submitted'
        });
      }

      // Format file attachments if any
      let attachments = [];
      if (req.files && req.files.length > 0) {
        attachments = formatFileInfo(req.files).map(file => ({
          ...file,
          url: getFileUrl(req, file.path)
        }));
      }

      // Create submission
      const submission = await db.query(
        `INSERT INTO assignment_submissions (assignment_id, student_id, submission_text, attachments)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [assignmentId, studentId, submissionText, JSON.stringify(attachments)]
      );

      res.status(201).json({
        success: true,
        message: 'Assignment submitted successfully',
        data: { submission: submission.rows[0] }
      });

    } catch (error) {
      console.error('Submit assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit assignment'
      });
    }
  },

  async gradeSubmission(req, res) {
    try {
      const { submissionId } = req.params;
      const { grade, feedback } = req.body;

      // Get submission
      const submission = await db.query(
        `SELECT s.*, a.teacher_id, a.class_id
         FROM assignment_submissions s
         JOIN assignments a ON s.assignment_id = a.id
         WHERE s.id = $1`,
        [submissionId]
      );

      if (submission.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Check if teacher owns the class
      const ownsClass = await assertTeacherOwnsClass(submission.rows[0].class_id, req.user.id);
      if (!ownsClass) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to grade this submission'
        });
      }

      // Update submission with grade
      const updatedSubmission = await db.query(
        `UPDATE assignment_submissions 
         SET grade = $1, feedback = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [grade, feedback, submissionId]
      );

      res.json({
        success: true,
        message: 'Submission graded successfully',
        data: { submission: updatedSubmission.rows[0] }
      });

    } catch (error) {
      console.error('Grade submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to grade submission'
      });
    }
  },

  async getSubmissionFileUrl(req, res) {
    try {
      const { submissionId, attachmentId } = req.params;

      // Get submission with assignment details
      const submission = await db.query(
        `SELECT s.*, a.teacher_id, a.class_id, a.title as assignment_title
         FROM assignment_submissions s
         JOIN assignments a ON s.assignment_id = a.id
         WHERE s.id = $1`,
        [submissionId]
      );

      if (submission.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      const submissionData = submission.rows[0];

      // Check authorization based on user type
      if (req.user.user_type === 'teacher') {
        const ownsClass = await assertTeacherOwnsClass(submissionData.class_id, req.user.id);
        if (!ownsClass) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to access this submission'
          });
        }
      } else if (req.user.user_type === 'student') {
        const inClass = await assertStudentInClass(submissionData.class_id, req.user.id);
        if (!inClass) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to access this submission'
          });
        }
      }

      // Parse attachments
      let attachments = [];
      try {
        if (typeof submissionData.attachments === 'string') {
          attachments = JSON.parse(submissionData.attachments || '[]');
        } else if (Array.isArray(submissionData.attachments)) {
          attachments = submissionData.attachments;
        } else {
          attachments = [];
        }
      } catch (error) {
        console.error('Error parsing attachments:', error);
        attachments = [];
      }

      // Find the specific attachment
      const attachment = attachments.find(att => att.filename === attachmentId);
      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: 'Attachment not found'
        });
      }

      // Generate secure file URL
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fileUrl = `${baseUrl}/uploads/submissions/${attachment.filename}`;

      res.json({
        success: true,
        message: 'File URL generated successfully',
        data: {
          fileUrl,
          attachment: {
            filename: attachment.filename,
            originalName: attachment.originalName,
            mimetype: attachment.mimetype,
            size: attachment.size,
            url: fileUrl
          }
        }
      });

    } catch (error) {
      console.error('Get submission file URL error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get file URL'
      });
    }
  },

  async getAssignmentFileUrl(req, res) {
    try {
      const { assignmentId, attachmentId } = req.params;

      // Get assignment details
      const assignment = await db.query(
        `SELECT a.*, c.teacher_id, a.class_id
         FROM assignments a
         JOIN classes c ON a.class_id = c.id
         WHERE a.id = $1`,
        [assignmentId]
      );

      if (assignment.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      const assignmentData = assignment.rows[0];

      // Check authorization based on user type
      if (req.user.user_type === 'teacher') {
        const ownsClass = await assertTeacherOwnsClass(assignmentData.class_id, req.user.id);
        if (!ownsClass) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to access this assignment'
          });
        }
      } else if (req.user.user_type === 'student') {
        const inClass = await assertStudentInClass(assignmentData.class_id, req.user.id);
        if (!inClass) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to access this assignment'
          });
        }
      }

      // Parse attachments
      let attachments = [];
      try {
        if (typeof assignmentData.attachments === 'string') {
          attachments = JSON.parse(assignmentData.attachments || '[]');
        } else if (Array.isArray(assignmentData.attachments)) {
          attachments = assignmentData.attachments;
        } else {
          attachments = [];
        }
      } catch (error) {
        console.error('Error parsing attachments:', error);
        attachments = [];
      }

      // Find the specific attachment
      const attachment = attachments.find(att => att.filename === attachmentId);
      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: 'Attachment not found'
        });
      }

      // Generate secure file URL
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fileUrl = `${baseUrl}/uploads/assignments/${attachment.filename}`;

      res.json({
        success: true,
        message: 'File URL generated successfully',
        data: {
          fileUrl,
          attachment: {
            filename: attachment.filename,
            originalName: attachment.originalName,
            mimetype: attachment.mimetype,
            size: attachment.size,
            url: fileUrl
          }
        }
      });

    } catch (error) {
      console.error('Get assignment file URL error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get file URL'
      });
    }
  }
};
