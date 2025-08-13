const db = require('../config/database');

// Get schedule for a specific week
const getScheduleByWeek = async (req, res) => {
  try {
    const userId = req.user.id;
    const { weekOffset = 0 } = req.params;

    // Calculate the start of the week
    const currentDate = new Date();
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() + (parseInt(weekOffset) * 7));
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday

    const schedule = await db.query(`
      SELECT 
        s.id,
        s.day_of_week,
        s.start_time,
        s.end_time,
        s.room,
        s.building,
        s.class_type,
        c.id as course_id,
        c.code as course_code,
        c.name as course_name,
        c.credits,
        u.first_name || ' ' || u.last_name as instructor_name
      FROM schedule s
      JOIN courses c ON s.course_id = c.id
      JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE e.student_id = $1 AND e.status = 'enrolled'
      ORDER BY s.day_of_week, s.start_time
    `, [userId]);

    // Group by day
    const scheduleByDay = {};
    for (let i = 1; i <= 7; i++) {
      scheduleByDay[i] = [];
    }

    schedule.rows.forEach(classItem => {
      scheduleByDay[classItem.day_of_week].push(classItem);
    });

    res.json({
      success: true,
      message: 'Schedule retrieved successfully',
      data: {
        week_start: weekStart.toISOString().split('T')[0],
        schedule: scheduleByDay
      }
    });

  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve schedule'
    });
  }
};

// Get today's schedule
const getTodaySchedule = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.

    const schedule = await db.query(`
      SELECT 
        s.id,
        s.start_time,
        s.end_time,
        s.room,
        s.building,
        s.class_type,
        c.id as course_id,
        c.code as course_code,
        c.name as course_name,
        c.credits,
        u.first_name || ' ' || u.last_name as instructor_name
      FROM schedule s
      JOIN courses c ON s.course_id = c.id
      JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE e.student_id = $1 AND e.status = 'enrolled' AND s.day_of_week = $2
      ORDER BY s.start_time
    `, [userId, today]);

    res.json({
      success: true,
      message: 'Today\'s schedule retrieved successfully',
      data: schedule.rows
    });

  } catch (error) {
    console.error('Get today schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve today\'s schedule'
    });
  }
};

// Get current week schedule
const getCurrentWeekSchedule = async (req, res) => {
  try {
    const userId = req.user.id;

    const schedule = await db.query(`
      SELECT 
        s.id,
        s.day_of_week,
        s.start_time,
        s.end_time,
        s.room,
        s.building,
        s.class_type,
        c.id as course_id,
        c.code as course_code,
        c.name as course_name,
        c.credits,
        u.first_name || ' ' || u.last_name as instructor_name
      FROM schedule s
      JOIN courses c ON s.course_id = c.id
      JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE e.student_id = $1 AND e.status = 'enrolled'
      ORDER BY s.day_of_week, s.start_time
    `, [userId]);

    // Group by day
    const scheduleByDay = {};
    for (let i = 1; i <= 7; i++) {
      scheduleByDay[i] = [];
    }

    schedule.rows.forEach(classItem => {
      scheduleByDay[classItem.day_of_week].push(classItem);
    });

    res.json({
      success: true,
      message: 'Current week schedule retrieved successfully',
      data: scheduleByDay
    });

  } catch (error) {
    console.error('Get current week schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve current week schedule'
    });
  }
};

module.exports = {
  getScheduleByWeek,
  getTodaySchedule,
  getCurrentWeekSchedule
};
