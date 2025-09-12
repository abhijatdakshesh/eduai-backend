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

// =========================
// Teacher Attendance Flow Methods
// =========================

// Get departments available to teacher
module.exports.getDepartments = async (req, res) => {
  try {
    const departments = await db.query(`
      SELECT d.id, d.name, d.code, d.description
      FROM departments d
      ORDER BY d.name
    `);

    res.json({ 
      success: true, 
      message: 'Departments retrieved successfully', 
      data: { departments: departments.rows } 
    });
  } catch (error) {
    console.error('getDepartments error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve departments' });
  }
};

// Get sections by department
module.exports.getSectionsByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;

    // Validate department exists
    const department = await db.query('SELECT id, name FROM departments WHERE id = $1', [departmentId]);
    if (department.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    // Get sections for the department
    const sections = await db.query(`
      SELECT DISTINCT s.name as section
      FROM sections s
      WHERE s.department_id = $1
      ORDER BY s.name
    `, [departmentId]);

    // If no sections found, return default sections
    const sectionList = sections.rows.length > 0 
      ? sections.rows.map(row => row.section)
      : ['A', 'B', 'C', 'D'];

    res.json({ 
      success: true, 
      message: 'Sections retrieved successfully', 
      data: { 
        department: department.rows[0],
        sections: sectionList 
      } 
    });
  } catch (error) {
    console.error('getSectionsByDepartment error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve sections' });
  }
};

// Get students by department, section, and time
module.exports.getStudentsByDepartmentSectionTime = async (req, res) => {
  try {
    const { departmentId, section, timeSlot, date } = req.query;

    if (!departmentId || !section || !timeSlot || !date) {
      return res.status(400).json({ 
        success: false, 
        message: 'departmentId, section, timeSlot, and date are required' 
      });
    }

    // Get students enrolled in the specific section
    const students = await db.query(`
      SELECT DISTINCT
        s.id as student_id,
        s.student_id as student_code,
        u.first_name,
        u.last_name,
        u.email
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN section_students ss ON s.id = ss.student_id
      JOIN sections sec ON ss.section_id = sec.id
      WHERE sec.department_id = $1 
        AND sec.name = $2
        AND ss.status = 'active'
        AND s.status = 'active'
      ORDER BY u.first_name, u.last_name
    `, [departmentId, section]);

    res.json({ 
      success: true, 
      message: 'Students retrieved successfully', 
      data: { students: students.rows } 
    });
  } catch (error) {
    console.error('getStudentsByDepartmentSectionTime error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve students' });
  }
};

// Save attendance with department/section/time context
module.exports.saveDepartmentSectionAttendance = async (req, res) => {
  try {
    const { departmentId, section, timeSlot, date, entries } = req.body;

    if (!departmentId || !section || !timeSlot || !date || !Array.isArray(entries)) {
      return res.status(400).json({ 
        success: false, 
        message: 'departmentId, section, timeSlot, date, and entries are required' 
      });
    }

    // Get teacher ID
    const teacher = await db.query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
    if (teacher.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }
    const teacherId = teacher.rows[0].id;

    // Validate statuses
    const allowedStatuses = new Set(['present', 'absent', 'late', 'excused']);
    for (const entry of entries) {
      if (entry.status && !allowedStatuses.has(entry.status)) {
        return res.status(400).json({ success: false, message: `Invalid status: ${entry.status}` });
      }
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      // Create or get teacher attendance record
      const attendanceResult = await db.query(`
        INSERT INTO teacher_attendance (teacher_id, department_id, section, time_slot, date)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (teacher_id, department_id, section, time_slot, date)
        DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [teacherId, departmentId, section, timeSlot, date]);

      const attendanceId = attendanceResult.rows[0].id;

      // Clear existing entries for this attendance record
      await db.query('DELETE FROM student_attendance_entries WHERE attendance_id = $1', [attendanceId]);

      // Insert new attendance entries
      let savedCount = 0;
      for (const entry of entries) {
        const status = entry.status || 'present';
        const notes = entry.notes || null;
        
        await db.query(`
          INSERT INTO student_attendance_entries (attendance_id, student_id, status, notes)
          VALUES ($1, $2, $3, $4)
        `, [attendanceId, entry.student_id, status, notes]);
        savedCount++;
      }

      await db.query('COMMIT');

      // Audit log
      try {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            req.user.id,
            'save_department_section_attendance',
            'teacher_attendance',
            attendanceId,
            JSON.stringify({ departmentId, section, timeSlot, date, entries_count: entries.length })
          ]
        );
      } catch (e) {
        console.warn('audit log failed:', e.message);
      }

      res.json({ 
        success: true, 
        message: 'Attendance saved successfully', 
        data: { 
          attendanceId,
          savedCount,
          departmentId,
          section,
          timeSlot,
          date
        } 
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('saveDepartmentSectionAttendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to save attendance' });
  }
};

// Get existing attendance records for department/section/time
module.exports.getDepartmentSectionAttendance = async (req, res) => {
  try {
    const { departmentId, section, timeSlot, date } = req.query;

    if (!departmentId || !section || !timeSlot || !date) {
      return res.status(400).json({ 
        success: false, 
        message: 'departmentId, section, timeSlot, and date are required' 
      });
    }

    // Get teacher ID
    const teacher = await db.query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
    if (teacher.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }
    const teacherId = teacher.rows[0].id;

    // Get attendance record with entries
    const attendance = await db.query(`
      SELECT 
        ta.id as attendance_id,
        ta.teacher_id,
        ta.department_id,
        ta.section,
        ta.time_slot,
        ta.date,
        ta.created_at,
        ta.updated_at
      FROM teacher_attendance ta
      WHERE ta.teacher_id = $1 
        AND ta.department_id = $2 
        AND ta.section = $3 
        AND ta.time_slot = $4 
        AND ta.date = $5
    `, [teacherId, departmentId, section, timeSlot, date]);

    if (attendance.rows.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No attendance record found', 
        data: { attendance: null, entries: [] } 
      });
    }

    const attendanceId = attendance.rows[0].attendance_id;

    // Get attendance entries
    const entries = await db.query(`
      SELECT 
        sae.id,
        sae.student_id,
        sae.status,
        sae.notes,
        sae.created_at,
        s.student_id as student_code,
        u.first_name,
        u.last_name
      FROM student_attendance_entries sae
      JOIN students s ON sae.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE sae.attendance_id = $1
      ORDER BY u.first_name, u.last_name
    `, [attendanceId]);

    res.json({ 
      success: true, 
      message: 'Attendance record retrieved successfully', 
      data: { 
        attendance: attendance.rows[0],
        entries: entries.rows
      } 
    });

  } catch (error) {
    console.error('getDepartmentSectionAttendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve attendance record' });
  }
};


