const db = require('../config/database');

// Dashboard Analytics
const getDashboardStats = async (req, res) => {
  try {
    // Get total counts
    const studentsCount = await db.query('SELECT COUNT(*) as count FROM students WHERE status = $1', ['active']);
    const teachersCount = await db.query('SELECT COUNT(*) as count FROM teachers WHERE status = $1', ['active']);
    const classesCount = await db.query('SELECT COUNT(*) as count FROM classes WHERE status = $1', ['active']);
    const coursesCount = await db.query('SELECT COUNT(*) as count FROM courses', []);

    // Get recent enrollments
    const recentEnrollments = await db.query(`
      SELECT sc.enrollment_date, s.student_id, u.first_name, u.last_name, c.name as class_name
      FROM student_classes sc
      JOIN students s ON sc.student_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN classes c ON sc.class_id = c.id
      ORDER BY sc.enrollment_date DESC
      LIMIT 5
    `);

    // Get attendance stats
    const attendanceStats = await db.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_count
      FROM attendance
      WHERE date = CURRENT_DATE
    `);

    res.json({
      success: true,
      message: 'Admin dashboard stats retrieved successfully',
      data: {
        stats: {
          total_students: parseInt(studentsCount.rows[0].count),
          total_teachers: parseInt(teachersCount.rows[0].count),
          total_classes: parseInt(classesCount.rows[0].count),
          total_courses: parseInt(coursesCount.rows[0].count),
          attendance_rate: attendanceStats.rows[0].total_records > 0 
            ? Math.round((attendanceStats.rows[0].present_count / attendanceStats.rows[0].total_records) * 100)
            : 0
        },
        recent_enrollments: recentEnrollments.rows
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
  getStudentAnalytics
};
