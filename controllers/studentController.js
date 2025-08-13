const db = require('../config/database');

module.exports = {
  async getMyAttendance(req, res) {
    try {
      const { from, to } = req.query;
      if (!from || !to) {
        return res.status(400).json({ success: false, message: 'from and to are required (YYYY-MM-DD)' });
      }

      // map user -> student
      const student = await db.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
      if (student.rows.length === 0) {
        return res.status(200).json({ success: true, message: 'No student profile', data: { attendance: [] } });
      }
      const studentId = student.rows[0].id;

      const rows = await db.query(
        `SELECT a.id AS attendance_id,
                a.class_id,
                c.name AS class_name,
                a.date,
                a.status,
                a.notes
         FROM attendance a
         JOIN classes c ON a.class_id = c.id
         WHERE a.student_id = $1 AND a.date BETWEEN $2 AND $3
         ORDER BY a.date DESC, a.created_at DESC`,
        [studentId, from, to]
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
      if (!from || !to) {
        return res.status(400).json({ success: false, message: 'from and to are required (YYYY-MM-DD)' });
      }

      const student = await db.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
      if (student.rows.length === 0) {
        return res.status(200).json({ success: true, message: 'No student profile', data: { summary: [] } });
      }
      const studentId = student.rows[0].id;

      const summary = await db.query(
        `SELECT status, COUNT(*)::int as count
         FROM attendance
         WHERE student_id = $1 AND date BETWEEN $2 AND $3
         GROUP BY status`,
        [studentId, from, to]
      );

      res.json({ success: true, message: 'Attendance summary', data: { summary: summary.rows } });
    } catch (error) {
      console.error('getMyAttendanceSummary error:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve summary' });
    }
  }
};


