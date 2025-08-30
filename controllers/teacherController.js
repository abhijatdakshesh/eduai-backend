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

  async getClass(req, res) {
    try {
      const { id } = req.params;
      const owns = await assertTeacherOwnsClass(id, req.user.id);
      if (!owns) {
        return res.status(403).json({ success: false, message: 'Not authorized for this class' });
      }

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

      // Resolve student identifiers: accept either UUIDs or student codes (e.g., "S001")
      const isUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      const roster = await db.query(
        `SELECT s.id AS student_uuid, s.student_id AS student_code
         FROM student_classes sc
         JOIN students s ON sc.student_id = s.id
         WHERE sc.class_id = $1`,
        [classId]
      );
      const codeToUuid = new Map(roster.rows.map(r => [r.student_code, r.student_uuid]));
      const enrolledUuidSet = new Set(roster.rows.map(r => r.student_uuid));

      const unresolved = [];
      const notEnrolled = [];
      const resolvedEntries = [];

      for (const e of entries) {
        const candidateId = e.student_id ?? null;
        const candidateCode = e.student_code ?? null;
        let resolvedUuid = null;

        if (candidateId) {
          if (isUuid(candidateId)) {
            resolvedUuid = candidateId;
          } else if (codeToUuid.has(candidateId)) {
            resolvedUuid = codeToUuid.get(candidateId);
          }
        }

        if (!resolvedUuid && candidateCode && codeToUuid.has(candidateCode)) {
          resolvedUuid = codeToUuid.get(candidateCode);
        }

        if (!resolvedUuid) {
          unresolved.push({ provided: e.student_id || e.student_code });
          continue;
        }

        if (!enrolledUuidSet.has(resolvedUuid)) {
          notEnrolled.push({ student_id: resolvedUuid });
          continue;
        }

        resolvedEntries.push({
          student_id: resolvedUuid,
          status: e.status,
          notes: e.notes
        });
      }

      if (unresolved.length > 0) {
        return res.status(400).json({ success: false, message: 'One or more students could not be resolved to an enrolled student in this class', data: { unresolved } });
      }

      if (notEnrolled.length > 0) {
        return res.status(400).json({ success: false, message: 'One or more students are not enrolled in this class', data: { notEnrolled } });
      }

      // Upsert all entries
      let updated = 0;
      for (const e of resolvedEntries) {
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
      if (!classId) {
        return res.status(400).json({ success: false, message: 'classId is required' });
      }

      const owns = await assertTeacherOwnsClass(classId, req.user.id);
      if (!owns) {
        return res.status(403).json({ success: false, message: 'Not authorized for this class' });
      }

      // Optional date filters with default last 30 days
      const conditions = ['class_id = $1'];
      const params = [classId];
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
      console.error('getAttendanceSummary error:', error);
      res.status(500).json({ success: false, message: 'Failed to get summary' });
    }
  }
};

// CSV helpers
const parseCsv = async (buffer) => {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const headers = lines.shift().split(',').map(h => h.trim());
  return lines.map(line => {
    const cols = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = (cols[i] || '').trim());
    return obj;
  });
};

module.exports.importAttendanceCsv = async (req, res) => {
  try {
    const { classId } = req.params;
    const owns = await assertTeacherOwnsClass(classId, req.user.id);
    if (!owns) return res.status(403).json({ success: false, message: 'Not authorized for this class' });

    if (!req.file) return res.status(400).json({ success: false, message: 'CSV file is required' });
    const rows = await parseCsv(req.file.buffer);

    const date = (req.body && req.body.date) || (rows[0] && rows[0].date);
    if (!date) return res.status(400).json({ success: false, message: 'date is required (YYYY-MM-DD)' });

    const entries = rows.map(r => ({ student_id: r.student_id || r.student_code, status: (r.status || '').toLowerCase(), notes: r.notes || null }));
    req.params.classId = classId;
    req.body = { date, entries };
    return module.exports.saveAttendanceBulk(req, res);
  } catch (err) {
    console.error('importAttendanceCsv error:', err);
    res.status(500).json({ success: false, message: 'Failed to import CSV' });
  }
};

module.exports.exportAttendanceCsv = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;
    const owns = await assertTeacherOwnsClass(classId, req.user.id);
    if (!owns) return res.status(403).json({ success: false, message: 'Not authorized for this class' });
    if (!date) return res.status(400).json({ success: false, message: 'date is required (YYYY-MM-DD)' });

    const rows = await db.query(
      `SELECT s.student_id AS student_code, u.first_name, u.last_name, a.status, COALESCE(a.notes,'') AS notes
       FROM student_classes sc
       JOIN students s ON sc.student_id = s.id
       JOIN users u ON s.user_id = u.id
       LEFT JOIN attendance a ON a.student_id = s.id AND a.class_id = sc.class_id AND a.date = $2
       WHERE sc.class_id = $1
       ORDER BY u.first_name, u.last_name`,
      [classId, date]
    );

    const header = 'student_code,first_name,last_name,status,notes\n';
    const csv = header + rows.rows.map(r => `${r.student_code},${r.first_name},${r.last_name},${r.status || ''},"${(r.notes || '').replace(/"/g, '""')}"`).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${classId}_${date}.csv"`);
    res.status(200).send(csv);
  } catch (err) {
    console.error('exportAttendanceCsv error:', err);
    res.status(500).json({ success: false, message: 'Failed to export CSV' });
  }
};

module.exports.getClassAttendanceSummary = async (req, res) => {
  try {
    const { classId } = req.params;
    const { from, to } = req.query;
    const owns = await assertTeacherOwnsClass(classId, req.user.id);
    if (!owns) return res.status(403).json({ success: false, message: 'Not authorized for this class' });

    const conditions = ['class_id = $1'];
    const params = [classId];
    const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
    const fmt = (d) => d.toISOString().slice(0,10);
    const today = new Date();
    if (from) { conditions.push(`date >= $${params.length+1}`); params.push(from); }
    if (to) { conditions.push(`date <= $${params.length+1}`); params.push(to); }
    if (!from && !to) { const fromDefault = fmt(addDays(today, -30)); conditions.push(`date >= $${params.length+1}`); params.push(fromDefault); }

    const summary = await db.query(
      `SELECT UPPER(status) AS status, COUNT(*)::int AS count
       FROM attendance
       WHERE ${conditions.join(' AND ')}
       GROUP BY UPPER(status)`,
      params
    );
    const totals = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const r of summary.rows) totals[r.status] = r.count;
    res.json({ success: true, message: 'Class attendance summary', data: totals });
  } catch (err) {
    console.error('getClassAttendanceSummary error:', err);
    res.status(500).json({ success: false, message: 'Failed to get summary' });
  }
};


