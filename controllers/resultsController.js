const db = require('../config/database');

// Get student results
const getResults = async (req, res) => {
  try {
    const userId = req.user.id;
    const { semester, year } = req.query;

    let whereConditions = ['r.student_id = $1'];
    let queryParams = [userId];
    let paramCount = 1;

    if (semester) {
      paramCount++;
      whereConditions.push(`r.semester = $${paramCount}`);
      queryParams.push(semester);
    }

    if (year) {
      paramCount++;
      whereConditions.push(`r.academic_year = $${paramCount}`);
      queryParams.push(year);
    }

    const results = await db.query(`
      SELECT 
        r.id,
        r.semester,
        r.academic_year as year,
        r.grade,
        r.points,
        r.credits,
        c.code as course_code,
        c.name as course_name,
        d.name as department_name
      FROM results r
      JOIN courses c ON r.course_id = c.id
      JOIN departments d ON c.department_id = d.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY r.academic_year DESC, r.semester DESC, c.name
    `, queryParams);

    res.json({
      success: true,
      message: 'Results retrieved successfully',
      data: results.rows
    });

  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve results'
    });
  }
};

// Get GPA
const getGPA = async (req, res) => {
  try {
    const userId = req.user.id;

    const gpaData = await db.query(`
      SELECT 
        AVG(r.points) as overall_gpa,
        SUM(r.credits) as total_credits,
        COUNT(r.id) as total_courses
      FROM results r
      WHERE r.student_id = $1
    `, [userId]);

    const semesterGPA = await db.query(`
      SELECT 
        r.semester,
        r.academic_year as year,
        AVG(r.points) as gpa,
        SUM(r.credits) as credits
      FROM results r
      WHERE r.student_id = $1
      GROUP BY r.semester, r.academic_year
      ORDER BY r.academic_year DESC, r.semester DESC
    `, [userId]);

    res.json({
      success: true,
      message: 'GPA retrieved successfully',
      data: {
        overall_gpa: gpaData.rows[0]?.overall_gpa || 0,
        total_credits: gpaData.rows[0]?.total_credits || 0,
        total_courses: gpaData.rows[0]?.total_courses || 0,
        semester_gpa: semesterGPA.rows
      }
    });

  } catch (error) {
    console.error('Get GPA error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve GPA'
    });
  }
};

// Get transcript
const getTranscript = async (req, res) => {
  try {
    const userId = req.user.id;

    const transcript = await db.query(`
      SELECT 
        r.semester,
        r.academic_year as year,
        c.code as course_code,
        c.name as course_name,
        c.credits,
        r.grade,
        r.points,
        d.name as department_name
      FROM results r
      JOIN courses c ON r.course_id = c.id
      JOIN departments d ON c.department_id = d.id
      WHERE r.student_id = $1
      ORDER BY r.academic_year DESC, r.semester DESC, c.name
    `, [userId]);

    res.json({
      success: true,
      message: 'Transcript retrieved successfully',
      data: transcript.rows
    });

  } catch (error) {
    console.error('Get transcript error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transcript'
    });
  }
};

// Get available years
const getYears = async (req, res) => {
  try {
    const userId = req.user.id;

    const years = await db.query(`
      SELECT DISTINCT academic_year as year
      FROM results
      WHERE student_id = $1
      ORDER BY academic_year DESC
    `, [userId]);

    res.json({
      success: true,
      message: 'Years retrieved successfully',
      data: years.rows
    });

  } catch (error) {
    console.error('Get years error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve years'
    });
  }
};

// Get available semesters
const getSemesters = async (req, res) => {
  try {
    const userId = req.user.id;

    const semesters = await db.query(`
      SELECT DISTINCT semester, academic_year as year
      FROM results
      WHERE student_id = $1
      ORDER BY academic_year DESC, semester DESC
    `, [userId]);

    res.json({
      success: true,
      message: 'Semesters retrieved successfully',
      data: semesters.rows
    });

  } catch (error) {
    console.error('Get semesters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve semesters'
    });
  }
};

module.exports = {
  getResults,
  getGPA,
  getTranscript,
  getYears,
  getSemesters
};
