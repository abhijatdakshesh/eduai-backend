const db = require('../config/database');

/**
 * Get parent information for a specific student
 */
const getStudentParents = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get student information
    const studentResult = await db.query(`
      SELECT s.id, s.student_id, u.first_name, u.last_name, u.email
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.student_id = $1 OR s.id = $1
    `, [studentId]);

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const student = studentResult.rows[0];

    // Get parent information through parent-student relationships
    const parentsResult = await db.query(`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.date_of_birth,
        u.gender,
        psr.relationship,
        psr.is_primary,
        p.parent_id as parent_identifier,
        p.primary_phone,
        p.secondary_phone,
        p.address_line1,
        p.address_line2,
        p.city,
        p.state,
        p.postal_code,
        p.country,
        p.verification_status
      FROM parent_student_relationships psr
      JOIN users u ON psr.parent_id = u.id
      LEFT JOIN parents p ON u.id = p.user_id
      WHERE psr.student_id = $1
      ORDER BY psr.is_primary DESC, u.first_name ASC
    `, [student.id]);

    const parents = parentsResult.rows.map(parent => ({
      id: parent.id,
      first_name: parent.first_name,
      last_name: parent.last_name,
      email: parent.email,
      phone: parent.phone || parent.primary_phone,
      date_of_birth: parent.date_of_birth,
      gender: parent.gender,
      relationship: parent.relationship,
      is_primary: parent.is_primary,
      parent_identifier: parent.parent_identifier,
      secondary_phone: parent.secondary_phone,
      address: {
        line1: parent.address_line1,
        line2: parent.address_line2,
        city: parent.city,
        state: parent.state,
        postal_code: parent.postal_code,
        country: parent.country
      },
      verification_status: parent.verification_status
    }));

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email
        },
        parents
      }
    });

  } catch (error) {
    console.error('Get student parents error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getStudentParents,
  async getMyAttendance(req, res) {
    try {
      const { from, to } = req.query;

      // map user -> student
      const student = await db.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
      if (student.rows.length === 0) {
        return res.status(200).json({ success: true, message: 'No student profile', data: { attendance: [] } });
      }
      const studentId = student.rows[0].id;

      // Optional date filters with default last 30 days
      const conditions = ['a.student_id = $1'];
      const params = [studentId];

      const addDays = (date, days) => {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
      };
      const fmt = (d) => d.toISOString().slice(0, 10);
      const today = new Date();
      if (from) {
        conditions.push(`a.date >= $${params.length + 1}`);
        params.push(from);
      }
      if (to) {
        conditions.push(`a.date <= $${params.length + 1}`);
        params.push(to);
      }
      if (!from && !to) {
        // default last 30 days
        const fromDefault = fmt(addDays(today, -30));
        conditions.push(`a.date >= $${params.length + 1}`);
        params.push(fromDefault);
      }

      const rows = await db.query(
        `SELECT a.id AS attendance_id,
                a.class_id,
                c.name AS class_name,
                a.date,
                a.status,
                a.notes
         FROM attendance a
         JOIN classes c ON a.class_id = c.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY a.date DESC, a.created_at DESC`,
        params
      );

      res.json({ success: true, message: 'Attendance retrieved', data: { attendance: rows.rows } });
    } catch (error) {
      console.error('getMyAttendance error:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve attendance' });
    }
  },

  async getMyAttendanceSummary(req, res) {
    try {
      const { from, to } = req.query;

      const student = await db.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
      if (student.rows.length === 0) {
        return res.status(200).json({ success: true, message: 'No student profile', data: { summary: [] } });
      }
      const studentId = student.rows[0].id;

      // Optional date filters with default last 30 days
      const conditions = ['student_id = $1'];
      const params = [studentId];
      const addDays = (date, days) => {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
      };
      const fmt = (d) => d.toISOString().slice(0, 10);
      const today = new Date();
      if (from) {
        conditions.push(`date >= $${params.length + 1}`);
        params.push(from);
      }
      if (to) {
        conditions.push(`date <= $${params.length + 1}`);
        params.push(to);
      }
      if (!from && !to) {
        const fromDefault = fmt(addDays(today, -30));
        conditions.push(`date >= $${params.length + 1}`);
        params.push(fromDefault);
      }

      const summary = await db.query(
        `SELECT UPPER(status) AS status, COUNT(*)::int as count
         FROM attendance
         WHERE ${conditions.join(' AND ')}
         GROUP BY UPPER(status)`,
        params
      );

      res.json({ success: true, message: 'Attendance summary', data: { summary: summary.rows } });
    } catch (error) {
      console.error('getMyAttendanceSummary error:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve summary' });
    }
  }
};


