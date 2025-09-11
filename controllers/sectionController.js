const db = require('../config/database');

// =========================
// Section Management
// =========================

// Create a new section
const createSection = async (req, res) => {
  try {
    const { name, department_id, academic_year } = req.body;

    // Validate required fields
    if (!name || !department_id || !academic_year) {
      return res.status(400).json({
        success: false,
        message: 'name, department_id, and academic_year are required'
      });
    }

    // Validate department exists
    const department = await db.query('SELECT id FROM departments WHERE id = $1', [department_id]);
    if (department.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if section already exists for this department and academic year
    const existingSection = await db.query(
      'SELECT id FROM sections WHERE name = $1 AND department_id = $2 AND academic_year = $3',
      [name, department_id, academic_year]
    );
    if (existingSection.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Section already exists for this department and academic year'
      });
    }

    // Create section
    const sectionResult = await db.query(`
      INSERT INTO sections (name, department_id, academic_year)
      VALUES ($1, $2, $3)
      RETURNING id, name, department_id, academic_year, created_at
    `, [name, department_id, academic_year]);

    const section = sectionResult.rows[0];

    // Log the action
    try {
      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, 'create', 'section', section.id, JSON.stringify({ name, department_id, academic_year })]
      );
    } catch (error) {
      console.log('Audit log error:', error.message);
    }

    res.status(201).json({
      success: true,
      message: 'Section created successfully',
      data: { section }
    });

  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create section'
    });
  }
};

// Get all sections with optional filtering
const getSections = async (req, res) => {
  try {
    const { department_id, academic_year, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramCount = 0;

    if (department_id) {
      paramCount++;
      whereConditions.push(`s.department_id = $${paramCount}`);
      queryParams.push(department_id);
    }

    if (academic_year) {
      paramCount++;
      whereConditions.push(`s.academic_year = $${paramCount}`);
      queryParams.push(academic_year);
    }

    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    const query = `
      SELECT 
        s.id, s.name, s.department_id, s.academic_year, s.created_at, s.updated_at,
        d.name as department_name, d.code as department_code,
        COUNT(DISTINCT ss.student_id) as student_count,
        COUNT(DISTINCT st.teacher_id) as teacher_count
      FROM sections s
      JOIN departments d ON s.department_id = d.id
      LEFT JOIN section_students ss ON s.id = ss.section_id AND ss.status = 'active'
      LEFT JOIN section_teachers st ON s.id = st.section_id AND st.status = 'active'
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY s.id, s.name, s.department_id, s.academic_year, s.created_at, s.updated_at, d.name, d.code
      ORDER BY s.academic_year DESC, s.name ASC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const sections = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sections s
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      message: 'Sections retrieved successfully',
      data: {
        sections: sections.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sections'
    });
  }
};

// Get section by ID with details
const getSection = async (req, res) => {
  try {
    const { id } = req.params;

    const sectionResult = await db.query(`
      SELECT 
        s.id, s.name, s.department_id, s.academic_year, s.created_at, s.updated_at,
        d.name as department_name, d.code as department_code
      FROM sections s
      JOIN departments d ON s.department_id = d.id
      WHERE s.id = $1
    `, [id]);

    if (sectionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    const section = sectionResult.rows[0];

    // Get students in this section
    const studentsResult = await db.query(`
      SELECT 
        ss.id, ss.enrollment_date, ss.status,
        s.student_id, s.grade_level,
        u.first_name, u.last_name, u.email, u.phone
      FROM section_students ss
      JOIN students s ON ss.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE ss.section_id = $1
      ORDER BY u.first_name, u.last_name
    `, [id]);

    // Get teachers assigned to this section
    const teachersResult = await db.query(`
      SELECT 
        st.id, st.role, st.assigned_date, st.status,
        t.teacher_id, t.department, t.specialization,
        u.first_name, u.last_name, u.email, u.phone
      FROM section_teachers st
      JOIN teachers t ON st.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE st.section_id = $1
      ORDER BY st.role, u.first_name, u.last_name
    `, [id]);

    res.json({
      success: true,
      message: 'Section details retrieved successfully',
      data: {
        section,
        students: studentsResult.rows,
        teachers: teachersResult.rows
      }
    });

  } catch (error) {
    console.error('Get section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve section details'
    });
  }
};

// Update section
const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department_id, academic_year } = req.body;

    // Check if section exists
    const existingSection = await db.query('SELECT id FROM sections WHERE id = $1', [id]);
    if (existingSection.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    // If changing name/department/academic_year, check for conflicts
    if (name || department_id || academic_year) {
      const currentSection = await db.query(
        'SELECT name, department_id, academic_year FROM sections WHERE id = $1',
        [id]
      );
      
      const newName = name || currentSection.rows[0].name;
      const newDepartmentId = department_id || currentSection.rows[0].department_id;
      const newAcademicYear = academic_year || currentSection.rows[0].academic_year;

      const conflictCheck = await db.query(
        'SELECT id FROM sections WHERE name = $1 AND department_id = $2 AND academic_year = $3 AND id != $4',
        [newName, newDepartmentId, newAcademicYear, id]
      );
      
      if (conflictCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Section with this name already exists for the department and academic year'
        });
      }
    }

    // Update section
    const updateResult = await db.query(`
      UPDATE sections 
      SET name = COALESCE($1, name),
          department_id = COALESCE($2, department_id),
          academic_year = COALESCE($3, academic_year),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, name, department_id, academic_year, created_at, updated_at
    `, [name, department_id, academic_year, id]);

    const section = updateResult.rows[0];

    // Log the action
    try {
      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, 'update', 'section', id, JSON.stringify(req.body)]
      );
    } catch (error) {
      console.log('Audit log error:', error.message);
    }

    res.json({
      success: true,
      message: 'Section updated successfully',
      data: { section }
    });

  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update section'
    });
  }
};

// Delete section
const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if section exists
    const section = await db.query('SELECT id FROM sections WHERE id = $1', [id]);
    if (section.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    // Check if section has students or teachers
    const studentsCount = await db.query(
      'SELECT COUNT(*) as count FROM section_students WHERE section_id = $1',
      [id]
    );
    const teachersCount = await db.query(
      'SELECT COUNT(*) as count FROM section_teachers WHERE section_id = $1',
      [id]
    );

    if (parseInt(studentsCount.rows[0].count) > 0 || parseInt(teachersCount.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete section with assigned students or teachers. Please remove all assignments first.'
      });
    }

    // Delete section
    await db.query('DELETE FROM sections WHERE id = $1', [id]);

    // Log the action
    try {
      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id) VALUES ($1, $2, $3, $4)',
        [req.user.id, 'delete', 'section', id]
      );
    } catch (error) {
      console.log('Audit log error:', error.message);
    }

    res.json({
      success: true,
      message: 'Section deleted successfully'
    });

  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete section'
    });
  }
};

// =========================
// Section-Student Assignment
// =========================

// Add students to section
const addStudentsToSection = async (req, res) => {
  try {
    const { id: sectionId } = req.params;
    const { studentIds } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'studentIds array is required'
      });
    }

    // Check if section exists
    const section = await db.query('SELECT id FROM sections WHERE id = $1', [sectionId]);
    if (section.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      let added = 0, skipped = 0;
      
      for (const studentId of studentIds) {
        try {
          // Check if student exists and is active
          const student = await client.query(
            'SELECT id FROM students WHERE id = $1 AND status = $2',
            [studentId, 'active']
          );
          
          if (student.rows.length === 0) {
            skipped++;
            continue;
          }

          // Add to section (ignore if already exists)
          await client.query(
            'INSERT INTO section_students (section_id, student_id) VALUES ($1, $2) ON CONFLICT (section_id, student_id) DO NOTHING',
            [sectionId, studentId]
          );
          
          const result = await client.query(
            'SELECT 1 FROM section_students WHERE section_id = $1 AND student_id = $2',
            [sectionId, studentId]
          );
          
          if (result.rows.length > 0) {
            added++;
          } else {
            skipped++;
          }
        } catch (error) {
          console.log(`Error adding student ${studentId}:`, error.message);
          skipped++;
        }
      }
      
      await client.query('COMMIT');

      // Log the action
      try {
        await db.query(
          'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
          [req.user.id, 'add_students', 'section', sectionId, JSON.stringify({ added, skipped, studentIds })]
        );
      } catch (error) {
        console.log('Audit log error:', error.message);
      }

      res.json({
        success: true,
        message: 'Students added to section',
        data: { added, skipped }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Add students to section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add students to section'
    });
  }
};

// Remove student from section
const removeStudentFromSection = async (req, res) => {
  try {
    const { id: sectionId, studentId } = req.params;

    const result = await db.query(
      'DELETE FROM section_students WHERE section_id = $1 AND student_id = $2 RETURNING id',
      [sectionId, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found in this section'
      });
    }

    // Log the action
    try {
      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, 'remove_student', 'section', sectionId, JSON.stringify({ studentId })]
      );
    } catch (error) {
      console.log('Audit log error:', error.message);
    }

    res.json({
      success: true,
      message: 'Student removed from section'
    });

  } catch (error) {
    console.error('Remove student from section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove student from section'
    });
  }
};

// Get available students for section (students not already in any section for the same academic year)
const getAvailableStudentsForSection = async (req, res) => {
  try {
    const { id: sectionId } = req.params;

    // Get section details to determine academic year
    const section = await db.query(
      'SELECT academic_year FROM sections WHERE id = $1',
      [sectionId]
    );

    if (section.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    const academicYear = section.rows[0].academic_year;

    // Get students not in any section for this academic year
    const students = await db.query(`
      SELECT 
        s.id, s.student_id, s.grade_level, s.enrollment_date,
        u.first_name, u.last_name, u.email, u.phone
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'active'
      AND s.id NOT IN (
        SELECT ss.student_id 
        FROM section_students ss
        JOIN sections sec ON ss.section_id = sec.id
        WHERE sec.academic_year = $1 AND ss.status = 'active'
      )
      ORDER BY u.first_name, u.last_name
    `, [academicYear]);

    res.json({
      success: true,
      message: 'Available students retrieved successfully',
      data: {
        students: students.rows
      }
    });

  } catch (error) {
    console.error('Get available students for section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available students'
    });
  }
};

// =========================
// Section-Teacher Assignment
// =========================

// Assign teacher to section
const assignTeacherToSection = async (req, res) => {
  try {
    const { id: sectionId } = req.params;
    const { teacherId, role = 'homeroom' } = req.body;

    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: 'teacherId is required'
      });
    }

    // Check if section exists
    const section = await db.query('SELECT id FROM sections WHERE id = $1', [sectionId]);
    if (section.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    // Check if teacher exists and is active
    const teacher = await db.query(
      'SELECT id FROM teachers WHERE id = $1 AND status = $2',
      [teacherId, 'active']
    );
    if (teacher.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found or inactive'
      });
    }

    // Assign teacher to section
    const result = await db.query(`
      INSERT INTO section_teachers (section_id, teacher_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (section_id, teacher_id, role) DO UPDATE SET
        status = 'active',
        assigned_date = CURRENT_DATE
      RETURNING id, section_id, teacher_id, role, assigned_date, status
    `, [sectionId, teacherId, role]);

    // Log the action
    try {
      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, 'assign_teacher', 'section', sectionId, JSON.stringify({ teacherId, role })]
      );
    } catch (error) {
      console.log('Audit log error:', error.message);
    }

    res.json({
      success: true,
      message: 'Teacher assigned to section',
      data: { assignment: result.rows[0] }
    });

  } catch (error) {
    console.error('Assign teacher to section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign teacher to section'
    });
  }
};

// Remove teacher from section
const removeTeacherFromSection = async (req, res) => {
  try {
    const { id: sectionId, teacherId } = req.params;

    const result = await db.query(
      'DELETE FROM section_teachers WHERE section_id = $1 AND teacher_id = $2 RETURNING id',
      [sectionId, teacherId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher assignment not found'
      });
    }

    // Log the action
    try {
      await db.query(
        'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, 'remove_teacher', 'section', sectionId, JSON.stringify({ teacherId })]
      );
    } catch (error) {
      console.log('Audit log error:', error.message);
    }

    res.json({
      success: true,
      message: 'Teacher removed from section'
    });

  } catch (error) {
    console.error('Remove teacher from section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove teacher from section'
    });
  }
};

// Get available teachers for section
const getAvailableTeachersForSection = async (req, res) => {
  try {
    const { id: sectionId } = req.params;

    // Get section details to determine department
    const section = await db.query(
      'SELECT department_id FROM sections WHERE id = $1',
      [sectionId]
    );

    if (section.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    const departmentId = section.rows[0].department_id;

    // Get teachers from the same department who are not already assigned to this section
    const teachers = await db.query(`
      SELECT 
        t.id, t.teacher_id, t.department, t.specialization,
        u.first_name, u.last_name, u.email, u.phone
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE t.status = 'active'
      AND t.department = (SELECT code FROM departments WHERE id = $1)
      AND t.id NOT IN (
        SELECT st.teacher_id 
        FROM section_teachers st
        WHERE st.section_id = $2 AND st.status = 'active'
      )
      ORDER BY u.first_name, u.last_name
    `, [departmentId, sectionId]);

    res.json({
      success: true,
      message: 'Available teachers retrieved successfully',
      data: {
        teachers: teachers.rows
      }
    });

  } catch (error) {
    console.error('Get available teachers for section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available teachers'
    });
  }
};

module.exports = {
  // Section CRUD
  createSection,
  getSections,
  getSection,
  updateSection,
  deleteSection,
  
  // Section-Student Assignment
  addStudentsToSection,
  removeStudentFromSection,
  getAvailableStudentsForSection,
  
  // Section-Teacher Assignment
  assignTeacherToSection,
  removeTeacherFromSection,
  getAvailableTeachersForSection
};
