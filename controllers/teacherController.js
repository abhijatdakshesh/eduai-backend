const db = require('../config/database');

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

module.exports = {
  async getMyClasses(req, res) {
    try {
      const teacher = await db.query(
        'SELECT id FROM teachers WHERE user_id = $1',
        [req.user.id]
      );

      if (teacher.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Teacher profile not found', data: { classes: [] } });
      }

      const teacherId = teacher.rows[0].id;
      const classes = await db.query(
        `SELECT id, name, grade_level, academic_year, max_students, current_students, status
         FROM classes
         WHERE teacher_id = $1
         ORDER BY created_at DESC NULLS LAST`,
        [teacherId]
      );

      res.json({ success: true, message: 'Classes retrieved', data: { classes: classes.rows } });
    } catch (error) {
      console.error('getMyClasses error:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve classes' });
    }
  },

  async getClassRoster(req, res) {
    try {
      const { classId } = req.params;
      const owns = await assertTeacherOwnsClass(classId, req.user.id);
      if (!owns) {
        return res.status(403).json({ success: false, message: 'Not authorized for this class' });
      }

      const roster = await db.query(
        `SELECT s.id AS student_db_id, s.student_id, u.first_name, u.last_name
         FROM student_classes sc
         JOIN students s ON sc.student_id = s.id
         JOIN users u ON s.user_id = u.id
         WHERE sc.class_id = $1
         ORDER BY u.first_name, u.last_name`,
        [classId]
      );

      res.json({ success: true, message: 'Roster retrieved', data: { students: roster.rows } });
    } catch (error) {
      console.error('getClassRoster error:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve roster' });
    }
  },

  async getAttendanceForDate(req, res) {
    try {
      const { classId } = req.params;
      const { date } = req.query;
      const owns = await assertTeacherOwnsClass(classId, req.user.id);
      if (!owns) {
        return res.status(403).json({ success: false, message: 'Not authorized for this class' });
      }

      const attendance = await db.query(
        `SELECT a.id AS attendance_id,
                a.student_id,
                a.class_id,
                a.date,
                a.status,
                a.notes
         FROM attendance a
         WHERE a.class_id = $1 AND a.date = $2
         ORDER BY a.created_at ASC`,
        [classId, date]
      );

      res.json({ success: true, message: 'Attendance retrieved', data: { attendance: attendance.rows } });
    } catch (error) {
      console.error('getAttendanceForDate error:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve attendance' });
    }
  },

  async saveAttendanceBulk(req, res) {
    try {
      const { classId } = req.params;
      const { date, entries } = req.body;

      if (!date || !Array.isArray(entries)) {
        return res.status(400).json({ success: false, message: 'date and entries are required' });
      }

      const owns = await assertTeacherOwnsClass(classId, req.user.id);
      if (!owns) {
        return res.status(403).json({ success: false, message: 'Not authorized for this class' });
      }

      // Optional: lock window (default 7 days) via env ATTENDANCE_EDIT_DAYS
      const editWindowDays = parseInt(process.env.ATTENDANCE_EDIT_DAYS || '7', 10);
      const inputDate = new Date(date);
      const today = new Date();
      const diffDays = Math.floor((today.setHours(0,0,0,0) - inputDate.setHours(0,0,0,0)) / (1000*60*60*24));
      if (diffDays > editWindowDays) {
        return res.status(403).json({ success: false, message: `Attendance editing locked after ${editWindowDays} days` });
      }

      // Validate statuses
      const allowedStatuses = new Set(['present', 'absent', 'late', 'excused']);
      for (const e of entries) {
        if (e.status && !allowedStatuses.has(e.status)) {
          return res.status(400).json({ success: false, message: `Invalid status: ${e.status}` });
        }
      }

      // Ensure each student is in the class
      const studentIds = entries.map(e => e.student_id);
      if (studentIds.length > 0) {
        const validStudents = await db.query(
          `SELECT sc.student_id
           FROM student_classes sc
           WHERE sc.class_id = $1 AND sc.student_id = ANY($2::uuid[])`,
          [classId, studentIds]
        );
        const validSet = new Set(validStudents.rows.map(r => r.student_id));
        for (const e of entries) {
          if (!validSet.has(e.student_id)) {
            return res.status(400).json({ success: false, message: 'One or more students are not enrolled in this class' });
          }
        }
      }

      // Upsert all entries
      let updated = 0;
      for (const e of entries) {
        const status = e.status || 'present';
        const notes = e.notes || null;
        await db.query(
          `INSERT INTO attendance (student_id, class_id, date, status, notes, recorded_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (student_id, class_id, date)
           DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes, recorded_by = EXCLUDED.recorded_by`,
          [e.student_id, classId, date, status, notes, req.user.id]
        );
        updated += 1;
      }

      // Audit log (summary)
      try {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            req.user.id,
            'save_attendance_bulk',
            'attendance',
            classId,
            JSON.stringify({ date, entries_count: entries.length })
          ]
        );
      } catch (e) {
        // non-fatal
        console.warn('audit log failed:', e.message);
      }

      res.json({ success: true, message: 'Attendance saved', data: { updated } });
    } catch (error) {
      console.error('saveAttendanceBulk error:', error);
      res.status(500).json({ success: false, message: 'Failed to save attendance' });
    }
  },

  async getAttendanceSummary(req, res) {
    try {
      const { from, to, classId } = req.query;
      if (!from || !to) {
        return res.status(400).json({ success: false, message: 'from and to are required (YYYY-MM-DD)' });
      }
      if (!classId) {
        return res.status(400).json({ success: false, message: 'classId is required' });
      }

      const owns = await assertTeacherOwnsClass(classId, req.user.id);
      if (!owns) {
        return res.status(403).json({ success: false, message: 'Not authorized for this class' });
      }

      const summary = await db.query(
        `SELECT status, COUNT(*)::int as count
         FROM attendance
         WHERE class_id = $1 AND date BETWEEN $2 AND $3
         GROUP BY status`,
        [classId, from, to]
      );

      res.json({ success: true, message: 'Attendance summary', data: { summary: summary.rows } });
    } catch (error) {
      console.error('getAttendanceSummary error:', error);
      res.status(500).json({ success: false, message: 'Failed to get summary' });
    }
  }
};


