const db = require('../config/database');

// Get all courses with filters
const getCourses = async (req, res) => {
  try {
    const { 
      department, 
      search, 
      semester, 
      year, 
      page = 1, 
      limit = 10 
    } = req.query;

    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramCount = 0;

    if (department) {
      paramCount++;
      whereConditions.push(`d.code = $${paramCount}`);
      queryParams.push(department);
    }

    if (search) {
      paramCount++;
      whereConditions.push(`(c.name ILIKE $${paramCount} OR c.code ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    if (semester) {
      paramCount++;
      whereConditions.push(`c.semester = $${paramCount}`);
      queryParams.push(semester);
    }

    if (year) {
      paramCount++;
      whereConditions.push(`c.year = $${paramCount}`);
      queryParams.push(year);
    }

    const offset = (page - 1) * limit;
    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    const query = `
      SELECT 
        c.id,
        c.code,
        c.name,
        c.description,
        c.credits,
        c.max_enrollment,
        c.current_enrollment,
        c.semester,
        c.year as year,
        d.name as department_name,
        d.code as department_code,
        u.first_name || ' ' || u.last_name as instructor_name,
        CASE 
          WHEN c.current_enrollment >= c.max_enrollment THEN 'full'
          ELSE 'available'
        END as enrollment_status
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY c.name
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const courses = await db.query(query, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      message: 'Courses retrieved successfully',
      data: {
        courses: courses.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve courses'
    });
  }
};

// Get course by ID
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await db.query(`
      SELECT 
        c.id,
        c.code,
        c.name,
        c.description,
        c.credits,
        c.max_enrollment,
        c.current_enrollment,
        c.semester,
        c.year as year,
        d.name as department_name,
        d.code as department_code,
        u.first_name || ' ' || u.last_name as instructor_name,
        u.email as instructor_email,
        CASE 
          WHEN c.current_enrollment >= c.max_enrollment THEN 'full'
          ELSE 'available'
        END as enrollment_status
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE c.id = $1
    `, [id]);

    if (course.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.json({
      success: true,
      message: 'Course retrieved successfully',
      data: course.rows[0]
    });

  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve course'
    });
  }
};

// Get departments
const getDepartments = async (req, res) => {
  try {
    const departments = await db.query(`
      SELECT id, name, code, description
      FROM departments
      ORDER BY name
    `);

    res.json({
      success: true,
      message: 'Departments retrieved successfully',
      data: departments.rows
    });

  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve departments'
    });
  }
};

// Enroll in a course
const enrollInCourse = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;

    // Check if course exists and has space
    const course = await db.query(`
      SELECT id, max_enrollment, current_enrollment
      FROM courses
      WHERE id = $1 AND is_active = true
    `, [courseId]);

    if (course.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (course.rows[0].current_enrollment >= course.rows[0].max_enrollment) {
      return res.status(400).json({
        success: false,
        message: 'Course is full'
      });
    }

    // Check if already enrolled
    const existingEnrollment = await db.query(`
      SELECT id FROM enrollments
      WHERE student_id = $1 AND course_id = $2
    `, [userId, courseId]);

    if (existingEnrollment.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Already enrolled in this course'
      });
    }

    // Enroll in course
    await db.query(`
      INSERT INTO enrollments (student_id, course_id, status)
      VALUES ($1, $2, 'enrolled')
    `, [userId, courseId]);

    // Update course enrollment count
    await db.query(`
      UPDATE courses
      SET current_enrollment = current_enrollment + 1
      WHERE id = $1
    `, [courseId]);

    res.json({
      success: true,
      message: 'Successfully enrolled in course'
    });

  } catch (error) {
    console.error('Enroll in course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enroll in course'
    });
  }
};

// Drop a course
const dropCourse = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;

    // Check if enrolled
    const enrollment = await db.query(`
      SELECT id FROM enrollments
      WHERE student_id = $1 AND course_id = $2 AND status = 'enrolled'
    `, [userId, courseId]);

    if (enrollment.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Not enrolled in this course'
      });
    }

    // Drop course
    await db.query(`
      UPDATE enrollments
      SET status = 'dropped'
      WHERE student_id = $1 AND course_id = $2
    `, [userId, courseId]);

    // Update course enrollment count
    await db.query(`
      UPDATE courses
      SET current_enrollment = current_enrollment - 1
      WHERE id = $1
    `, [courseId]);

    res.json({
      success: true,
      message: 'Successfully dropped course'
    });

  } catch (error) {
    console.error('Drop course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to drop course'
    });
  }
};

// Get enrolled courses
const getEnrolledCourses = async (req, res) => {
  try {
    const userId = req.user.id;

    const enrolledCourses = await db.query(`
      SELECT 
        c.id,
        c.code,
        c.name,
        c.credits,
        c.semester,
        c.year as year,
        d.name as department_name,
        u.first_name || ' ' || u.last_name as instructor_name,
        e.status,
        e.grade,
        e.points,
        e.enrollment_date
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      JOIN departments d ON c.department_id = d.id
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE e.student_id = $1
      ORDER BY c.semester DESC, c.year DESC, c.name
    `, [userId]);

    res.json({
      success: true,
      message: 'Enrolled courses retrieved successfully',
      data: enrolledCourses.rows
    });

  } catch (error) {
    console.error('Get enrolled courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve enrolled courses'
    });
  }
};

module.exports = {
  getCourses,
  getCourseById,
  getDepartments,
  enrollInCourse,
  dropCourse,
  getEnrolledCourses
};
