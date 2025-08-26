const db = require('../config/database');

// Utility: paginate with limit & after (cursor = created_at,id)
function buildCursorPaging(query, params, { after, limit = 20 }) {
  const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  if (after) {
    const [createdAtIso, id] = decodeURIComponent(after).split('|');
    params.push(createdAtIso, id);
    query.where.push('(a.created_at, a.id) < ($' + (params.length - 1) + ', $' + params.length + ')');
  }
  query.order.push('a.created_at DESC, a.id DESC');
  query.limit = pageLimit + 1; // fetch one extra to compute nextCursor
  return pageLimit;
}

function computeNextCursor(rows, pageLimit) {
  if (rows.length <= pageLimit) return null;
  const last = rows[pageLimit - 1];
  return encodeURIComponent(`${new Date(last.created_at).toISOString()}|${last.id}`);
}

// Validate teacher scope
async function assertTeacherScope(teacherUserId, { scope_type, scope_id }) {
  if (scope_type === 'global') return true;
  if (!scope_id) throw new Error('scope_id required when scope_type is not global');
  // teacher id
  const teacher = await db.query('SELECT id FROM teachers WHERE user_id = $1', [teacherUserId]);
  if (teacher.rows.length === 0) throw new Error('Teacher profile not found');
  const teacherId = teacher.rows[0].id;
  if (scope_type === 'class') {
    const r = await db.query('SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2', [scope_id, teacherId]);
    if (r.rows.length === 0) throw new Error('Not allowed to post to this class');
  }
  // course-based scope could be validated similarly if course ownership exists
  return true;
}

// Compute audience user set SQL for student/parent scoping
const SCOPE_SQL = `
  (CASE 
     WHEN a.scope_type = 'global' THEN TRUE
     WHEN a.scope_type = 'class' THEN EXISTS (
       SELECT 1 FROM student_classes sc WHERE sc.class_id = a.scope_id AND sc.student_id = s.id
     )
     WHEN a.scope_type = 'course' THEN EXISTS (
       SELECT 1 FROM student_courses sc WHERE sc.course_id = a.scope_id AND sc.student_id = s.id
     )
     ELSE FALSE
   END)
`;

// Teacher: create announcement
async function createTeacherAnnouncement(req, res) {
  try {
    const teacherUserId = req.user.id;
    const { title, body, attachments = [], scope_type = 'global', scope_id = null, audience = 'both', pinned = false, expires_at = null, is_active = true } = req.body || {};

    if (!title || !body) return res.status(400).json({ success: false, message: 'title and body are required' });

    await assertTeacherScope(teacherUserId, { scope_type, scope_id });

    const created = await db.query(
      `INSERT INTO announcements (title, body, attachments, scope_type, scope_id, audience, created_by, pinned, expires_at, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,(SELECT id FROM teachers WHERE user_id = $7),$8,$9,$10)
       RETURNING id, title, body, attachments, scope_type, scope_id, audience, pinned, expires_at, is_active, created_at`,
      [title, body, JSON.stringify(attachments), scope_type, scope_id, audience, teacherUserId, pinned, expires_at, is_active]
    );

    res.json({ success: true, message: 'Announcement created', data: { announcement: created.rows[0] } });
  } catch (err) {
    console.error('createTeacherAnnouncement error:', err);
    res.status(400).json({ success: false, message: err.message || 'Failed to create announcement' });
  }
}

// Teacher: list own
async function listTeacherAnnouncements(req, res) {
  try {
    const teacherUserId = req.user.id;
    const { limit, after, pinned, is_active } = req.query;
    const params = [teacherUserId];
    const q = { where: [ 't.user_id = $1' ], order: [], limit: 0 };

    if (pinned !== undefined) { params.push(pinned === 'true'); q.where.push(`a.pinned = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active === 'true'); q.where.push(`a.is_active = $${params.length}`); }

    const pageLimit = buildCursorPaging(q, params, { limit, after });

    const sql = `
      SELECT a.*
      FROM announcements a
      JOIN teachers t ON a.created_by = t.id
      WHERE ${q.where.join(' AND ')}
      ORDER BY ${q.order.join(', ')}
      LIMIT ${q.limit}
    `;
    const rows = (await db.query(sql, params)).rows;
    const nextCursor = computeNextCursor(rows, pageLimit);

    res.json({ success: true, message: 'Teacher announcements', data: { announcements: rows.slice(0, pageLimit), paging: { nextCursor } } });
  } catch (err) {
    console.error('listTeacherAnnouncements error:', err);
    res.status(500).json({ success: false, message: 'Failed to list announcements' });
  }
}

// Teacher: update (pin/archive/edit)
async function updateTeacherAnnouncement(req, res) {
  try {
    const teacherUserId = req.user.id;
    const { id } = req.params;
    const { title, body, attachments, pinned, is_active, expires_at } = req.body || {};

    // ensure ownership
    const owned = await db.query(`
      SELECT a.id FROM announcements a
      JOIN teachers t ON a.created_by = t.id
      WHERE a.id = $1 AND t.user_id = $2
    `, [id, teacherUserId]);
    if (owned.rows.length === 0) return res.status(403).json({ success: false, message: 'Not allowed' });

    const sets = []; const params = []; let i = 0;
    if (title !== undefined) { params.push(title); sets.push(`title = $${++i}`); }
    if (body !== undefined) { params.push(body); sets.push(`body = $${++i}`); }
    if (attachments !== undefined) { params.push(JSON.stringify(attachments)); sets.push(`attachments = $${++i}`); }
    if (pinned !== undefined) { params.push(!!pinned); sets.push(`pinned = $${++i}`); }
    if (is_active !== undefined) { params.push(!!is_active); sets.push(`is_active = $${++i}`); }
    if (expires_at !== undefined) { params.push(expires_at); sets.push(`expires_at = $${++i}`); }
    sets.push(`updated_at = NOW()`);

    if (sets.length === 1) return res.json({ success: true, message: 'No changes' });

    params.push(id);
    const updated = await db.query(`UPDATE announcements SET ${sets.join(', ')} WHERE id = $${++i} RETURNING *`, params);

    res.json({ success: true, message: 'Announcement updated', data: { announcement: updated.rows[0] } });
  } catch (err) {
    console.error('updateTeacherAnnouncement error:', err);
    res.status(500).json({ success: false, message: 'Failed to update announcement' });
  }
}

// Student: list
async function listStudentAnnouncements(req, res) {
  try {
    const userId = req.user.id;
    const { limit, after, classId, pinned } = req.query;

    // find student entity
    const sRes = await db.query('SELECT id FROM students WHERE user_id = $1', [userId]);
    if (sRes.rows.length === 0) return res.json({ success: true, message: 'No student profile', data: { announcements: [], paging: { nextCursor: null }, unread_count: 0 } });
    const studentId = sRes.rows[0].id;

    // Params must start with studentId/userId so cursor placeholders compute correctly
    const params = [studentId, userId];
    const q = { where: ["a.is_active = TRUE", "(a.expires_at IS NULL OR a.expires_at > NOW())", "a.audience IN ('students','both')"], order: [], limit: 0 };
    if (pinned !== undefined) { params.push(pinned === 'true'); q.where.push(`a.pinned = $${params.length}`); }
    if (classId) { params.push(classId); q.where.push(`(a.scope_type = 'global' OR (a.scope_type = 'class' AND a.scope_id = $${params.length}))`); }

    const pageLimit = buildCursorPaging(q, params, { limit, after });

    const rows = (await db.query(`
      WITH s AS (SELECT id FROM students WHERE id = $1)
      SELECT a.*, (SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = $2) IS NOT NULL AS is_read
      FROM announcements a, s
      WHERE ${q.where.join(' AND ')} AND ${SCOPE_SQL}
      ORDER BY ${q.order.join(', ')}
      LIMIT ${q.limit}
    `, params)).rows;

    const unreadCount = (await db.query(`
      WITH s AS (SELECT id FROM students WHERE id = $1)
      SELECT COUNT(*)::int AS cnt
      FROM announcements a, s
      WHERE ${q.where.join(' AND ')} AND ${SCOPE_SQL}
        AND NOT EXISTS (SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = $2)
    `, params)).rows[0].cnt;

    const nextCursor = computeNextCursor(rows, pageLimit);
    res.json({ success: true, message: 'Student announcements', data: { announcements: rows.slice(0, pageLimit), paging: { nextCursor }, unread_count: unreadCount } });
  } catch (err) {
    console.error('listStudentAnnouncements error:', err);
    res.status(500).json({ success: false, message: 'Failed to list announcements' });
  }
}

// Student: mark read
async function markStudentAnnouncementRead(req, res) {
  try {
    const userId = req.user.id; const { id } = req.params;
    await db.query(`INSERT INTO announcement_reads (announcement_id, user_id) VALUES ($1,$2) ON CONFLICT (announcement_id, user_id) DO UPDATE SET read_at = NOW()`, [id, userId]);
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    console.error('markStudentAnnouncementRead error:', err);
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
}

// Parent: list (by children classes)
async function listParentAnnouncements(req, res) {
  try {
    const userId = req.user.id;
    const { limit, after, childId, pinned } = req.query;

    // linked students for this parent
    const p = await db.query('SELECT id FROM parents WHERE user_id = $1', [userId]);
    if (p.rows.length === 0) return res.json({ success: true, message: 'No parent profile', data: { announcements: [], paging: { nextCursor: null }, unread_count: 0 } });
    const parentId = p.rows[0].id;

    const childList = await db.query(`
      SELECT s.id FROM parent_students ps JOIN students s ON ps.student_id = s.id WHERE ps.parent_id = $1
    `, [parentId]);
    const studentIds = childList.rows.map(r => r.id);
    if (studentIds.length === 0) return res.json({ success: true, message: 'No linked children', data: { announcements: [], paging: { nextCursor: null }, unread_count: 0 } });

    // Constrain to one child if provided
    let targetStudentIds = studentIds;
    if (childId && studentIds.includes(childId)) targetStudentIds = [childId];

    // Params must start with studentIds and userId so cursor placeholders compute correctly
    const params = [targetStudentIds, userId];
    const q = { where: ["a.is_active = TRUE", "(a.expires_at IS NULL OR a.expires_at > NOW())", "a.audience IN ('parents','both')"], order: [], limit: 0 };
    if (pinned !== undefined) { params.push(pinned === 'true'); q.where.push(`a.pinned = $${params.length}`); }

    const pageLimit = buildCursorPaging(q, params, { limit, after });

    const rows = (await db.query(`
      WITH students AS (
        SELECT unnest($1::uuid[]) AS id
      )
      SELECT a.*, (SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = $2) IS NOT NULL AS is_read
      FROM announcements a, students s
      WHERE ${q.where.join(' AND ')} AND ${SCOPE_SQL}
      ORDER BY ${q.order.join(', ')}
      LIMIT ${q.limit}
    `, params)).rows;

    const unreadCount = (await db.query(`
      WITH students AS (
        SELECT unnest($1::uuid[]) AS id
      )
      SELECT COUNT(*)::int AS cnt
      FROM announcements a, students s
      WHERE ${q.where.join(' AND ')} AND ${SCOPE_SQL}
        AND NOT EXISTS (SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = $2)
    `, params)).rows[0].cnt;

    const nextCursor = computeNextCursor(rows, pageLimit);
    res.json({ success: true, message: 'Parent announcements', data: { announcements: rows.slice(0, pageLimit), paging: { nextCursor }, unread_count: unreadCount } });
  } catch (err) {
    console.error('listParentAnnouncements error:', err);
    res.status(500).json({ success: false, message: 'Failed to list announcements' });
  }
}

// Parent: mark read
async function markParentAnnouncementRead(req, res) {
  try {
    const userId = req.user.id; const { id } = req.params;
    await db.query(`INSERT INTO announcement_reads (announcement_id, user_id) VALUES ($1,$2) ON CONFLICT (announcement_id, user_id) DO UPDATE SET read_at = NOW()`, [id, userId]);
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    console.error('markParentAnnouncementRead error:', err);
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
}

module.exports = {
  // teacher
  createTeacherAnnouncement,
  listTeacherAnnouncements,
  updateTeacherAnnouncement,
  // student
  listStudentAnnouncements,
  markStudentAnnouncementRead,
  // parent
  listParentAnnouncements,
  markParentAnnouncementRead
};
