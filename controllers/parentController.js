const db = require('../config/database');
const announcementsController = require('./announcementsController');

module.exports = {
  async getDashboard(req, res) {
    try {
      // parent -> children count, unread announcements, unpaid invoices, upcoming events
      const parent = await db.query('SELECT id FROM parents WHERE user_id = $1', [req.user.id]);
      if (parent.rows.length === 0) {
        return res.json({ success: true, message: 'No parent profile', data: { children_count: 0, unread_announcements: 0, unpaid_invoices: 0, upcoming_events: 0 } });
      }
      const parentId = parent.rows[0].id;

      const childrenCount = await db.query('SELECT COUNT(*)::int AS count FROM parent_students WHERE parent_id = $1', [parentId]);
      const unreadAnnouncements = await db.query("SELECT COUNT(*)::int AS count FROM announcements WHERE is_published = true", []);
      const unpaidInvoices = await db.query("SELECT COUNT(*)::int AS count FROM fees f JOIN students s ON f.student_id = s.user_id JOIN parent_students ps ON ps.student_id = s.id WHERE ps.parent_id = $1 AND f.status <> 'paid'", [parentId]);
      const upcomingEvents = await db.query("SELECT 0::int AS count", []);

      res.json({ success: true, message: 'Parent dashboard', data: {
        children_count: childrenCount.rows[0].count,
        unread_announcements: unreadAnnouncements.rows[0].count,
        unpaid_invoices: unpaidInvoices.rows[0].count,
        upcoming_events: upcomingEvents.rows[0].count
      }});
    } catch (err) {
      console.error('getDashboard error:', err);
      res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
  },

  async getChildren(req, res) {
    try {
      const parent = await db.query('SELECT id FROM parents WHERE user_id = $1', [req.user.id]);
      if (parent.rows.length === 0) {
        return res.json({ success: true, message: 'No parent profile', data: { children: [] } });
      }
      const parentId = parent.rows[0].id;
      const children = await db.query(
        `SELECT s.id, s.student_id, s.grade_level, u.first_name, u.last_name, u.avatar_url
         FROM parent_students ps
         JOIN students s ON ps.student_id = s.id
         JOIN users u ON s.user_id = u.id
         WHERE ps.parent_id = $1
         ORDER BY u.first_name, u.last_name`,
        [parentId]
      );
      res.json({ success: true, message: 'Children list', data: { children: children.rows } });
    } catch (err) {
      console.error('getChildren error:', err);
      res.status(500).json({ success: false, message: 'Failed to load children' });
    }
  },

  async getChildAttendance(req, res) {
    try {
      const { studentId } = req.params;
      const { from, to } = req.query;

      const conditions = ['a.student_id = $1'];
      const params = [studentId];
      const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
      const fmt = (d) => d.toISOString().slice(0,10);
      const today = new Date();
      if (from) { conditions.push(`a.date >= $${params.length+1}`); params.push(from); }
      if (to) { conditions.push(`a.date <= $${params.length+1}`); params.push(to); }
      if (!from && !to) { const fromDefault = fmt(addDays(today, -30)); conditions.push(`a.date >= $${params.length+1}`); params.push(fromDefault); }

      const rows = await db.query(
        `SELECT a.date, a.status, a.notes, c.name AS class_name
         FROM attendance a
         JOIN classes c ON a.class_id = c.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY a.date DESC, a.created_at DESC`,
        params
      );
      res.json({ success: true, message: 'Child attendance', data: { attendance: rows.rows } });
    } catch (err) {
      console.error('getChildAttendance error:', err);
      res.status(500).json({ success: false, message: 'Failed to load attendance' });
    }
  },

  async getChildAttendanceSummary(req, res) {
    try {
      const { studentId } = req.params;
      const { from, to } = req.query;
      const conditions = ['student_id = $1'];
      const params = [studentId];
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
      // convert to totals map
      const totals = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
      for (const row of summary.rows) totals[row.status] = row.count;
      res.json({ success: true, message: 'Child attendance summary', data: { totals } });
    } catch (err) {
      console.error('getChildAttendanceSummary error:', err);
      res.status(500).json({ success: false, message: 'Failed to load summary' });
    }
  },

  async getChildInfo(req, res) {
    try {
      const { studentId } = req.params;
      
      const childInfo = await db.query(
        `SELECT 
          s.id,
          s.student_id,
          s.grade_level,
          u.first_name,
          u.last_name,
          u.email,
          u.avatar_url,
          c.name as class_name,
          t.first_name as teacher_first_name,
          t.last_name as teacher_last_name
         FROM students s
         JOIN users u ON s.user_id = u.id
         LEFT JOIN student_classes sc ON s.id = sc.student_id
         LEFT JOIN classes c ON sc.class_id = c.id
         LEFT JOIN teachers te ON c.teacher_id = te.id
         LEFT JOIN users t ON te.user_id = t.id
         WHERE s.id = $1`,
        [studentId]
      );

      if (childInfo.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Child not found' 
        });
      }

      res.json({ 
        success: true, 
        message: 'Child info retrieved successfully', 
        data: { child: childInfo.rows[0] } 
      });
    } catch (err) {
      console.error('getChildInfo error:', err);
      res.status(500).json({ success: false, message: 'Failed to load child info' });
    }
  },

  async getAnnouncements(req, res) {
    // Backward-compat wrapper: delegate to new unified parent listing
    // Supports: limit, after, childId, pinned
    return announcementsController.listParentAnnouncements(req, res);
  }
};


