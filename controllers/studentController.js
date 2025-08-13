const db = require('../config/database');

module.exports = {
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


