const db = require('../config/database');

// Dashboard Analytics
const getDashboardStats = async (req, res) => {
  try {
    // Totals
    const studentsCount = await db.query(`SELECT COUNT(*)::int AS count FROM students WHERE status = 'active'`);
    const teachersCount = await db.query(`SELECT COUNT(*)::int AS count FROM teachers WHERE status = 'active'`);
    const classesCount = await db.query(`SELECT COUNT(*)::int AS count FROM classes WHERE status = 'active'`);
    const coursesCount = await db.query(`SELECT COUNT(*)::int AS count FROM courses`);
    const parentsCount = await db.query(`SELECT COUNT(*)::int AS count FROM parents`);

    // Active enrollments (class enrollments)
    const activeEnrollments = await db.query(`SELECT COUNT(*)::int AS count FROM student_classes`);

    // Attendance rate (today)
    const attendanceStats = await db.query(`
      SELECT 
        COUNT(*)::int AS total_records,
        COUNT(CASE WHEN status = 'present' THEN 1 END)::int AS present_count
      FROM attendance
      WHERE date = CURRENT_DATE
    `);
    const totalRecords = attendanceStats.rows[0].total_records || 0;
    const presentCount = attendanceStats.rows[0].present_count || 0;
    const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

    // Average GPA across all published results (fallback to enrollments points if present)
    const avgGpaResult = await db.query(`
      SELECT ROUND(AVG(points)::numeric, 2) AS avg_points FROM results WHERE points IS NOT NULL AND (is_published = TRUE OR is_published IS NULL)
    `);
    const averageGPA = Number(avgGpaResult.rows[0].avg_points || 0);

    // New enrollments (students created in last 30 days by enrollment_date)
    const newEnrollments = await db.query(`
      SELECT COUNT(*)::int AS count FROM students WHERE enrollment_date >= CURRENT_DATE - INTERVAL '30 days'
    `);

    // Pending approvals (scholarship applications pending, if table exists)
    let pendingApprovalsCount = 0;
    try {
      const pending = await db.query(`SELECT COUNT(*)::int AS count FROM scholarship_applications WHERE status = 'pending'`);
      pendingApprovalsCount = pending.rows[0].count || 0;
    } catch (_) {
      pendingApprovalsCount = 0;
    }

    res.json({
      success: true,
      message: 'Admin dashboard stats retrieved successfully',
      data: {
        stats: {
          totalStudents: studentsCount.rows[0].count,
          totalTeachers: teachersCount.rows[0].count,
          totalClasses: classesCount.rows[0].count,
          totalCourses: coursesCount.rows[0].count,
          totalParents: parentsCount.rows[0].count,
          activeEnrollments: activeEnrollments.rows[0].count,
          attendanceRate: attendanceRate,
          averageGPA: averageGPA,
          newEnrollments: newEnrollments.rows[0].count,
          pendingApprovals: pendingApprovalsCount
        }
      }
    });

  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve admin dashboard stats'
    });
  }
};

// User Management
const getUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramCount = 0;

    if (role && role !== 'all') {
      paramCount++;
      whereConditions.push(`u.user_type = $${paramCount}`);
      queryParams.push(role);
    }

    if (search) {
      paramCount++;
      whereConditions.push(`(u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    const query = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.user_type, 
        u.phone, u.date_of_birth, u.gender, u.email_verified, 
        u.is_active, u.created_at, u.updated_at
      FROM users u
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY u.created_at DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const users = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users: users.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users'
    });
  }
};

const createUser = async (req, res) => {
  try {
    const { 
      email, password, first_name, last_name, user_type, 
      phone, date_of_birth, gender 
    } = req.body;

    // Basic validation
    if (!email || !password || !first_name || !last_name || !user_type) {
      return res.status(400).json({
        success: false,
        message: 'email, password, first_name, last_name, and user_type are required'
      });
    }

    // Check if user already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userResult = await db.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, user_type, phone, date_of_birth, gender)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, first_name, last_name, user_type, created_at
    `, [email, passwordHash, first_name, last_name, user_type, phone, date_of_birth, gender]);

    const user = userResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      first_name, last_name, user_type, phone, 
      date_of_birth, gender, is_active 
    } = req.body;

    const updateResult = await db.query(`
      UPDATE users 
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          user_type = COALESCE($3, user_type),
          phone = COALESCE($4, phone),
          date_of_birth = COALESCE($5, date_of_birth),
          gender = COALESCE($6, gender),
          is_active = COALESCE($7, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING id, email, first_name, last_name, user_type, phone, date_of_birth, gender, is_active, updated_at
    `, [first_name, last_name, user_type, phone, date_of_birth, gender, is_active, id]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user: updateResult.rows[0] }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const userResult = await db.query('SELECT id, user_type FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete by setting is_active to false
    await db.query('UPDATE users SET is_active = FALSE WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

// Student Management
const getStudents = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, grade_level } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['s.status = $1'];
    let queryParams = ['active'];
    let paramCount = 1;

    if (search) {
      paramCount++;
      whereConditions.push(`(u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR s.student_id ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    if (grade_level) {
      paramCount++;
      whereConditions.push(`s.grade_level = $${paramCount}`);
      queryParams.push(grade_level);
    }

    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    const query = `
      SELECT 
        s.id, s.student_id, s.grade_level, s.enrollment_date, s.academic_year,
        u.first_name, u.last_name, u.email, u.phone, u.date_of_birth, u.gender,
        p.parent_id, p.relationship
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN parents p ON s.parent_id = p.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY s.created_at DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const students = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      message: 'Students retrieved successfully',
      data: {
        students: students.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve students'
    });
  }
};

const createStudent = async (req, res) => {
  try {
    const { 
      user_id, student_id, grade_level, enrollment_date, 
      parent_id, academic_year 
    } = req.body;

    // Validate required fields
    if (!user_id || !student_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id and student_id are required'
      });
    }

    // Validate referenced user exists and is of type student (or convertible to student)
    const userRow = await db.query('SELECT id, user_type, is_active FROM users WHERE id = $1', [user_id]);
    if (userRow.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Referenced user_id does not exist' });
    }
    if (!userRow.rows[0].is_active) {
      return res.status(400).json({ success: false, message: 'Referenced user account is inactive' });
    }
    // Optional: enforce user_type
    // Allow both pre-created students and converting an existing user to student
    if (userRow.rows[0].user_type !== 'student') {
      try {
        await db.query('UPDATE users SET user_type = $1 WHERE id = $2', ['student', user_id]);
      } catch (_) {}
    }

    // Check if student_id already exists
    const existingStudent = await db.query('SELECT id FROM students WHERE student_id = $1', [student_id]);
    if (existingStudent.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Student ID already exists'
      });
    }

    // Create student
    const studentResult = await db.query(`
      INSERT INTO students (user_id, student_id, grade_level, enrollment_date, parent_id, academic_year)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, student_id, grade_level, enrollment_date, academic_year
    `, [user_id, student_id, grade_level, enrollment_date, parent_id, academic_year]);

    const student = studentResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: { student }
    });

  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create student'
    });
  }
};

// Teacher Management
const getTeachers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, department } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['t.status = $1'];
    let queryParams = ['active'];
    let paramCount = 1;

    if (search) {
      paramCount++;
      whereConditions.push(`(u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR t.teacher_id ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    if (department) {
      paramCount++;
      whereConditions.push(`t.department = $${paramCount}`);
      queryParams.push(department);
    }

    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    const query = `
      SELECT 
        t.id, t.teacher_id, t.department, t.specialization, t.hire_date,
        t.qualification, t.experience_years,
        u.first_name, u.last_name, u.email, u.phone, u.date_of_birth, u.gender
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY t.created_at DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const teachers = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      message: 'Teachers retrieved successfully',
      data: {
        teachers: teachers.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve teachers'
    });
  }
};

const createTeacher = async (req, res) => {
  try {
    const { 
      user_id, teacher_id, department, specialization, 
      hire_date, qualification, experience_years 
    } = req.body;

    // Check if teacher_id already exists
    const existingTeacher = await db.query('SELECT id FROM teachers WHERE teacher_id = $1', [teacher_id]);
    if (existingTeacher.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Teacher ID already exists'
      });
    }

    // Create teacher
    const teacherResult = await db.query(`
      INSERT INTO teachers (user_id, teacher_id, department, specialization, hire_date, qualification, experience_years)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, teacher_id, department, specialization, hire_date, qualification, experience_years
    `, [user_id, teacher_id, department, specialization, hire_date, qualification, experience_years]);

    const teacher = teacherResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      data: { teacher }
    });

  } catch (error) {
    console.error('Create teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create teacher'
    });
  }
};

// Class Management
const getClasses = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, grade_level } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['c.status = $1'];
    let queryParams = ['active'];
    let paramCount = 1;

    if (search) {
      paramCount++;
      whereConditions.push(`c.name ILIKE $${paramCount}`);
      queryParams.push(`%${search}%`);
    }

    if (grade_level) {
      paramCount++;
      whereConditions.push(`c.grade_level = $${paramCount}`);
      queryParams.push(grade_level);
    }

    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    const query = `
      SELECT 
        c.id, c.name, c.grade_level, c.academic_year, c.max_students, c.current_students,
        t.teacher_id, u.first_name as teacher_first_name, u.last_name as teacher_last_name,
        r.room_number, r.building
      FROM classes c
      LEFT JOIN teachers t ON c.teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN rooms r ON c.room_id = r.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY c.created_at DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const classes = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM classes c
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      message: 'Classes retrieved successfully',
      data: {
        classes: classes.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve classes'
    });
  }
};

const createClass = async (req, res) => {
  try {
    const { 
      name, grade_level, academic_year, teacher_id, 
      room_id, max_students 
    } = req.body;

    // Create class
    const classResult = await db.query(`
      INSERT INTO classes (name, grade_level, academic_year, teacher_id, room_id, max_students)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, grade_level, academic_year, max_students, current_students
    `, [name, grade_level, academic_year, teacher_id, room_id, max_students]);

    const newClass = classResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: { class: newClass }
    });

  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create class'
    });
  }
};

// Analytics
const getStudentAnalytics = async (req, res) => {
  try {
    // Get student enrollment trends
    const enrollmentTrends = await db.query(`
      SELECT 
        DATE_TRUNC('month', enrollment_date) as month,
        COUNT(*) as enrollments
      FROM students
      WHERE enrollment_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', enrollment_date)
      ORDER BY month
    `);

    // Get grade level distribution
    const gradeDistribution = await db.query(`
      SELECT 
        grade_level,
        COUNT(*) as count
      FROM students
      WHERE status = 'active'
      GROUP BY grade_level
      ORDER BY grade_level
    `);

    // Get attendance statistics
    const attendanceStats = await db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM attendance
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY status
    `);

    res.json({
      success: true,
      message: 'Student analytics retrieved successfully',
      data: {
        enrollment_trends: enrollmentTrends.rows,
        grade_distribution: gradeDistribution.rows,
        attendance_stats: attendanceStats.rows
      }
    });

  } catch (error) {
    console.error('Student analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student analytics'
    });
  }
};

// Attendance Audit
const getAttendanceAudit = async (req, res) => {
  try {
    const { class_id, date, student_id, status } = req.query;
    
    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramCount = 0;

    if (class_id) {
      paramCount++;
      whereConditions.push(`a.class_id = $${paramCount}`);
      queryParams.push(class_id);
    }

    if (date) {
      paramCount++;
      whereConditions.push(`a.date = $${paramCount}`);
      queryParams.push(date);
    }

    if (student_id) {
      paramCount++;
      whereConditions.push(`a.student_id = $${paramCount}`);
      queryParams.push(student_id);
    }

    if (status) {
      paramCount++;
      whereConditions.push(`a.status = $${paramCount}`);
      queryParams.push(status);
    }

    const audit = await db.query(`
      SELECT 
        a.id,
        a.date,
        a.status,
        a.notes,
        a.created_at,
        s.student_id,
        u.first_name,
        u.last_name,
        c.name as class_name,
        t.first_name as teacher_first_name,
        t.last_name as teacher_last_name
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN classes c ON a.class_id = c.id
      JOIN teachers te ON c.teacher_id = te.id
      JOIN users t ON te.user_id = t.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY a.date DESC, a.created_at DESC
      LIMIT 100
    `, queryParams);

    res.json({
      success: true,
      message: 'Attendance audit retrieved successfully',
      data: { audit: audit.rows }
    });

  } catch (error) {
    console.error('Attendance audit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance audit'
    });
  }
};

// =========================
// Admin: Extended Endpoints
// =========================

const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { grade_level, enrollment_date, parent_id, academic_year, status } = req.body;
    const result = await db.query(`
      UPDATE students
      SET grade_level = COALESCE($1, grade_level),
          enrollment_date = COALESCE($2, enrollment_date),
          parent_id = COALESCE($3, parent_id),
          academic_year = COALESCE($4, academic_year),
          status = COALESCE($5, status)
      WHERE id = $6
      RETURNING id, student_id, grade_level, enrollment_date, academic_year, status
    `, [grade_level, enrollment_date, parent_id, academic_year, status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    try {
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'update', 'student', id, JSON.stringify(req.body)]
      );
    } catch (_) {}

    res.json({ success: true, message: 'Student updated', data: { student: result.rows[0] } });
  } catch (error) {
    console.error('updateStudent error:', error);
    res.status(500).json({ success: false, message: 'Failed to update student' });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await db.query('UPDATE students SET status = $1 WHERE id = $2 RETURNING id', ['inactive', id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4)`, [req.user.id, 'delete', 'student', id]); } catch (_) {}
    res.json({ success: true, message: 'Student deleted' });
  } catch (error) {
    console.error('deleteStudent error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete student' });
  }
};

const parseCsvBuffer = async (buffer) => {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines.shift().split(',').map(h => h.trim());
  return lines.map(line => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, i) => row[h] = (cols[i] || '').trim());
    return row;
  });
};

const importStudentsCsv = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'CSV file is required' });
    const rows = await parseCsvBuffer(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ success: false, message: 'CSV is empty' });

    let created = 0, skipped = 0;
    for (const r of rows) {
      const studentId = r.student_id || r.studentId || r.admission_no;
      const userId = r.user_id || r.userId;
      if (!studentId || !userId) { skipped++; continue; }

      const exists = await db.query('SELECT 1 FROM students WHERE student_id = $1', [studentId]);
      if (exists.rows.length > 0) { skipped++; continue; }

      await db.query(
        `INSERT INTO students (user_id, student_id, grade_level, enrollment_date, academic_year)
         VALUES ($1,$2,$3,$4,$5)`,
        [userId, studentId, r.grade_level || null, r.enrollment_date || null, r.academic_year || null]
      );
      created++;
    }

    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, details) VALUES ($1,$2,$3,$4)`, [req.user.id, 'import', 'student', JSON.stringify({ created, skipped })]); } catch (_) {}

    res.json({ success: true, message: 'Import complete', data: { created, skipped } });
  } catch (error) {
    console.error('importStudentsCsv error:', error);
    res.status(500).json({ success: false, message: 'Failed to import students' });
  }
};

const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const { department, specialization, hire_date, qualification, experience_years, status } = req.body;
    const r = await db.query(`
      UPDATE teachers
      SET department = COALESCE($1, department),
          specialization = COALESCE($2, specialization),
          hire_date = COALESCE($3, hire_date),
          qualification = COALESCE($4, qualification),
          experience_years = COALESCE($5, experience_years),
          status = COALESCE($6, status)
      WHERE id = $7
      RETURNING id, teacher_id, department, specialization, hire_date, qualification, experience_years, status
    `, [department, specialization, hire_date, qualification, experience_years, status, id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Teacher not found' });
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4)`, [req.user.id, 'update', 'teacher', id]); } catch (_) {}
    res.json({ success: true, message: 'Teacher updated', data: { teacher: r.rows[0] } });
  } catch (error) {
    console.error('updateTeacher error:', error);
    res.status(500).json({ success: false, message: 'Failed to update teacher' });
  }
};

const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await db.query('UPDATE teachers SET status = $1 WHERE id = $2 RETURNING id', ['inactive', id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Teacher not found' });
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4)`, [req.user.id, 'delete', 'teacher', id]); } catch (_) {}
    res.json({ success: true, message: 'Teacher deleted' });
  } catch (error) {
    console.error('deleteTeacher error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete teacher' });
  }
};

const getClassStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await db.query(`
      SELECT s.id, s.student_id, u.first_name, u.last_name
      FROM student_classes sc
      JOIN students s ON sc.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE sc.class_id = $1
      ORDER BY u.first_name, u.last_name
    `, [id]);
    res.json({ success: true, message: 'Class students', data: { students: rows.rows } });
  } catch (error) {
    console.error('getClassStudents error:', error);
    res.status(500).json({ success: false, message: 'Failed to load class students' });
  }
};

const getClassTeachers = async (req, res) => {
  try {
    const { id } = req.params;
    // Current schema has one homeroom teacher via classes.teacher_id
    const rows = await db.query(`
      SELECT te.id, te.teacher_id, u.first_name, u.last_name
      FROM classes c
      LEFT JOIN teachers te ON c.teacher_id = te.id
      LEFT JOIN users u ON te.user_id = u.id
      WHERE c.id = $1
    `, [id]);
    res.json({ success: true, message: 'Class teachers', data: { teachers: rows.rows.filter(r => r && r.id) } });
  } catch (error) {
    console.error('getClassTeachers error:', error);
    res.status(500).json({ success: false, message: 'Failed to load class teachers' });
  }
};

const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, grade_level, academic_year, teacher_id, room_id, max_students, status } = req.body;
    const r = await db.query(`
      UPDATE classes
      SET name = COALESCE($1, name),
          grade_level = COALESCE($2, grade_level),
          academic_year = COALESCE($3, academic_year),
          teacher_id = COALESCE($4, teacher_id),
          room_id = COALESCE($5, room_id),
          max_students = COALESCE($6, max_students),
          status = COALESCE($7, status)
      WHERE id = $8
      RETURNING id, name, grade_level, academic_year, teacher_id, room_id, max_students, current_students, status
    `, [name, grade_level, academic_year, teacher_id, room_id, max_students, status, id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Class not found' });
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4)`, [req.user.id, 'update', 'class', id]); } catch (_) {}
    res.json({ success: true, message: 'Class updated', data: { class: r.rows[0] } });
  } catch (error) {
    console.error('updateClass error:', error);
    res.status(500).json({ success: false, message: 'Failed to update class' });
  }
};

const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await db.query('UPDATE classes SET status = $1 WHERE id = $2 RETURNING id', ['inactive', id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Class not found' });
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4)`, [req.user.id, 'delete', 'class', id]); } catch (_) {}
    res.json({ success: true, message: 'Class deleted' });
  } catch (error) {
    console.error('deleteClass error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete class' });
  }
};

const addStudentsToClassBulk = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params; // class id
    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'studentIds array is required' });
    }
    await client.query('BEGIN');
    let added = 0, skipped = 0;
    for (const sid of studentIds) {
      try {
        await client.query(
          `INSERT INTO student_classes (student_id, class_id) VALUES ($1,$2) ON CONFLICT (student_id, class_id) DO NOTHING`,
          [sid, id]
        );
        const row = await client.query('SELECT 1 FROM student_classes WHERE student_id=$1 AND class_id=$2', [sid, id]);
        if (row.rows.length > 0) added++; else skipped++;
      } catch (_) { skipped++; }
    }
    await client.query('COMMIT');
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)`, [req.user.id, 'enroll_bulk', 'class', id, JSON.stringify({ added, skipped })]); } catch (_) {}
    res.json({ success: true, message: 'Students added to class', data: { added, skipped } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('addStudentsToClassBulk error:', error);
    res.status(500).json({ success: false, message: 'Failed to add students' });
  } finally {
    client.release();
  }
};

const removeStudentFromClass = async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const r = await db.query('DELETE FROM student_classes WHERE class_id = $1 AND student_id = $2 RETURNING id', [id, studentId]);
    if (r.rowCount === 0) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)`, [req.user.id, 'unenroll', 'class', id, JSON.stringify({ studentId })]); } catch (_) {}
    res.json({ success: true, message: 'Student removed from class' });
  } catch (error) {
    console.error('removeStudentFromClass error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove student' });
  }
};

const assignTeacherToClass = async (req, res) => {
  try {
    const { id } = req.params; // class id
    const { teacherId } = req.body;
    if (!teacherId) return res.status(400).json({ success: false, message: 'teacherId is required' });
    const r = await db.query('UPDATE classes SET teacher_id = $1 WHERE id = $2 RETURNING id, teacher_id', [teacherId, id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Class not found' });
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)`, [req.user.id, 'assign_teacher', 'class', id, JSON.stringify({ teacherId })]); } catch (_) {}
    res.json({ success: true, message: 'Teacher assigned', data: { class: r.rows[0] } });
  } catch (error) {
    console.error('assignTeacherToClass error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign teacher' });
  }
};

const unassignTeacherFromClass = async (req, res) => {
  try {
    const { id, teacherId } = req.params;
    const r = await db.query('UPDATE classes SET teacher_id = NULL WHERE id = $1 AND teacher_id = $2 RETURNING id', [id, teacherId]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Assignment not found' });
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)`, [req.user.id, 'unassign_teacher', 'class', id, JSON.stringify({ teacherId })]); } catch (_) {}
    res.json({ success: true, message: 'Teacher unassigned' });
  } catch (error) {
    console.error('unassignTeacherFromClass error:', error);
    res.status(500).json({ success: false, message: 'Failed to unassign teacher' });
  }
};

const getParents = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;
    const conditions = ['1=1'];
    const params = [];
    if (search) { params.push(`%${search}%`); conditions.push(`(u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
    params.push(limit); params.push(offset);
    const rows = await db.query(`
      SELECT p.id, p.parent_id, u.first_name, u.last_name, u.email, p.primary_phone
      FROM parents p
      JOIN users u ON p.user_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.first_name
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    res.json({ success: true, message: 'Parents retrieved', data: { parents: rows.rows, pagination: { page: parseInt(page), limit: parseInt(limit) } } });
  } catch (error) {
    console.error('getParents error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve parents' });
  }
};

const createParent = async (req, res) => {
  try {
    const { user_id, parent_id, primary_phone, secondary_phone, address_line1, address_line2, city, state, postal_code, country } = req.body;
    const exists = await db.query('SELECT 1 FROM parents WHERE parent_id = $1', [parent_id]);
    if (exists.rows.length > 0) return res.status(400).json({ success: false, message: 'parent_id already exists' });
    const r = await db.query(`
      INSERT INTO parents (user_id, parent_id, primary_phone, secondary_phone, address_line1, address_line2, city, state, postal_code, country)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, parent_id
    `, [user_id, parent_id, primary_phone, secondary_phone, address_line1, address_line2, city, state, postal_code, country]);
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4)`, [req.user.id, 'create', 'parent', r.rows[0].id]); } catch (_) {}
    res.status(201).json({ success: true, message: 'Parent created', data: { parent: r.rows[0] } });
  } catch (error) {
    console.error('createParent error:', error);
    res.status(500).json({ success: false, message: 'Failed to create parent' });
  }
};

const updateParent = async (req, res) => {
  try {
    const { id } = req.params;
    const { primary_phone, secondary_phone, address_line1, address_line2, city, state, postal_code, country, verification_status } = req.body;
    const r = await db.query(`
      UPDATE parents
      SET primary_phone = COALESCE($1, primary_phone),
          secondary_phone = COALESCE($2, secondary_phone),
          address_line1 = COALESCE($3, address_line1),
          address_line2 = COALESCE($4, address_line2),
          city = COALESCE($5, city),
          state = COALESCE($6, state),
          postal_code = COALESCE($7, postal_code),
          country = COALESCE($8, country),
          verification_status = COALESCE($9, verification_status)
      WHERE id = $10
      RETURNING id, parent_id
    `, [primary_phone, secondary_phone, address_line1, address_line2, city, state, postal_code, country, verification_status, id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Parent not found' });
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4)`, [req.user.id, 'update', 'parent', id]); } catch (_) {}
    res.json({ success: true, message: 'Parent updated', data: { parent: r.rows[0] } });
  } catch (error) {
    console.error('updateParent error:', error);
    res.status(500).json({ success: false, message: 'Failed to update parent' });
  }
};

const deleteParent = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM parent_students WHERE parent_id = $1', [id]);
    const r = await db.query('DELETE FROM parents WHERE id = $1 RETURNING id', [id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Parent not found' });
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4)`, [req.user.id, 'delete', 'parent', id]); } catch (_) {}
    res.json({ success: true, message: 'Parent deleted' });
  } catch (error) {
    console.error('deleteParent error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete parent' });
  }
};

const linkParentChild = async (req, res) => {
  try {
    const { parentId, studentId } = req.params;
    const r = await db.query(`
      INSERT INTO parent_students (parent_id, student_id)
      VALUES ($1,$2)
      ON CONFLICT (parent_id, student_id) DO NOTHING
      RETURNING id
    `, [parentId, studentId]);
    if (r.rows.length === 0) return res.status(200).json({ success: true, message: 'Already linked' });
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)`, [req.user.id, 'link', 'parent_child', r.rows[0].id, JSON.stringify({ parentId, studentId })]); } catch (_) {}
    res.status(201).json({ success: true, message: 'Parent linked to child' });
  } catch (error) {
    console.error('linkParentChild error:', error);
    res.status(500).json({ success: false, message: 'Failed to link parent and child' });
  }
};

const unlinkParentChild = async (req, res) => {
  try {
    const { parentId, studentId } = req.params;
    const r = await db.query('DELETE FROM parent_students WHERE parent_id = $1 AND student_id = $2 RETURNING id', [parentId, studentId]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Link not found' });
    try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)`, [req.user.id, 'unlink', 'parent_child', r.rows[0].id, JSON.stringify({ parentId, studentId })]); } catch (_) {}
    res.json({ success: true, message: 'Parent unlinked from child' });
  } catch (error) {
    console.error('unlinkParentChild error:', error);
    res.status(500).json({ success: false, message: 'Failed to unlink parent and child' });
  }
};

// Get single class details
const getClass = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        c.id, c.name, c.grade_level, c.academic_year, c.max_students, 
        c.current_students, c.status, c.created_at,
        t.id as teacher_id,
        u.first_name as teacher_first_name, 
        u.last_name as teacher_last_name,
        u.email as teacher_email
      FROM classes c
      LEFT JOIN teachers t ON c.teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.json({
      success: true,
      message: 'Class details retrieved successfully',
      data: {
        class: result.rows[0]
      }
    });

  } catch (error) {
    console.error('getClass error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve class details'
    });
  }
};

// Get available students for a class (students not already enrolled)
const getAvailableStudents = async (req, res) => {
  try {
    const { id: classId } = req.params;
    
    const result = await db.query(`
      SELECT 
        s.id, s.student_id, s.grade_level, s.enrollment_date,
        u.first_name, u.last_name, u.email, u.phone
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'active'
      AND s.id NOT IN (
        SELECT student_id 
        FROM student_classes 
        WHERE class_id = $1
      )
      ORDER BY u.first_name, u.last_name
    `, [classId]);

    res.json({
      success: true,
      message: 'Available students retrieved successfully',
      data: {
        students: result.rows
      }
    });

  } catch (error) {
    console.error('getAvailableStudents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available students'
    });
  }
};

// Get class attendance
const getClassAttendance = async (req, res) => {
  try {
    const { id: classId } = req.params;
    const { date } = req.query;
    
    // Use provided date or default to today
    const attendanceDate = date || new Date().toISOString().split('T')[0];
    
    const result = await db.query(`
      SELECT 
        a.id, a.status, a.notes, a.created_at,
        s.student_id, s.id as student_record_id,
        u.first_name, u.last_name, u.email
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN student_classes sc ON s.id = sc.student_id
      WHERE sc.class_id = $1 
      AND a.date = $2
      ORDER BY u.first_name, u.last_name
    `, [classId, attendanceDate]);

    res.json({
      success: true,
      message: 'Class attendance retrieved successfully',
      data: {
        attendance: result.rows,
        date: attendanceDate
      }
    });

  } catch (error) {
    console.error('getClassAttendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve class attendance'
    });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getStudents,
  createStudent,
  getTeachers,
  createTeacher,
  getClasses,
  createClass,
  getClass,
  getStudentAnalytics,
  getAttendanceAudit,
  // Added admin endpoints per checklist
  updateStudent,
  deleteStudent,
  importStudentsCsv,
  updateTeacher,
  deleteTeacher,
  getClassStudents,
  getClassTeachers,
  getAvailableStudents,
  getClassAttendance,
  updateClass,
  deleteClass,
  addStudentsToClassBulk,
  removeStudentFromClass,
  assignTeacherToClass,
  unassignTeacherFromClass,
  getParents,
  createParent,
  updateParent,
  deleteParent,
  linkParentChild,
  unlinkParentChild
};
