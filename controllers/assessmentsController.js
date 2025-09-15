const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const emailService = require('../utils/emailService');

async function getTeacherIdForUser(userId) {
  const r = await db.query('SELECT id FROM teachers WHERE user_id = $1', [userId]);
  return r.rows[0]?.id || null;
}

async function assertTeacherAssignedToSection(teacherUserId, sectionId) {
  const r = await db.query(
    `SELECT 1
     FROM section_teachers st
     JOIN teachers t ON st.teacher_id = t.id
     WHERE st.section_id = $1 AND t.user_id = $2 AND st.status = 'active'`,
    [sectionId, teacherUserId]
  );
  return r.rows.length > 0;
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = {
  // POST /assessments
  async createAssessment(req, res) {
    try {
      const {
        sectionId,
        subjectId,
        name,
        date,
        maxMarks,
        weightage,
        term,
        notes
      } = req.body;

      if (!sectionId || !subjectId || !name || !date || !maxMarks) {
        return res.status(400).json({ success: false, message: 'sectionId, subjectId, name, date, maxMarks are required' });
      }

      if (req.user.user_type !== 'teacher' && req.user.user_type !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only teachers or admins can create assessments' });
      }

      if (req.user.user_type === 'teacher') {
        const allowed = await assertTeacherAssignedToSection(req.user.id, sectionId);
        if (!allowed) return res.status(403).json({ success: false, message: 'Not authorized for this section' });
      }

      const teacherId = await getTeacherIdForUser(req.user.id);

      const result = await db.query(
        `INSERT INTO assessments (section_id, subject_id, name, date, max_marks, weightage, term, status, created_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9)
         RETURNING *`,
        [sectionId, subjectId, name, date, maxMarks, weightage || null, term || null, teacherId || req.user.id, notes || null]
      );

      // Audit
      try {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
           VALUES ($1,$2,$3,$4,$5)`,
          [req.user.id, 'create_assessment', 'assessment', result.rows[0].id, JSON.stringify({ sectionId, subjectId, name })]
        );
      } catch (e) {}

      res.status(201).json({ success: true, message: 'Assessment created', data: result.rows[0] });
    } catch (err) {
      console.error('createAssessment error:', err);
      res.status(500).json({ success: false, message: 'Failed to create assessment' });
    }
  },

  // GET /assessments/:id
  async getAssessment(req, res) {
    try {
      const { id } = req.params;
      const r = await db.query(
        `SELECT a.*, s.name AS section_name
         FROM assessments a
         JOIN sections s ON a.section_id = s.id
         WHERE a.id = $1`,
        [id]
      );
      if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Assessment not found' });

      const assessment = r.rows[0];
      if (req.user.user_type === 'teacher') {
        const allowed = await assertTeacherAssignedToSection(req.user.id, assessment.section_id);
        if (!allowed) return res.status(403).json({ success: false, message: 'Not authorized for this assessment' });
      }

      res.json({ success: true, message: 'Assessment retrieved', data: assessment });
    } catch (err) {
      console.error('getAssessment error:', err);
      res.status(500).json({ success: false, message: 'Failed to get assessment' });
    }
  },

  // PUT /assessments/:id (only when draft)
  async updateAssessment(req, res) {
    try {
      const { id } = req.params;
      const existing = await db.query('SELECT * FROM assessments WHERE id = $1', [id]);
      if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Assessment not found' });
      const assessment = existing.rows[0];

      if (assessment.status !== 'draft') return res.status(400).json({ success: false, message: 'Assessment is not editable' });
      if (req.user.user_type === 'teacher') {
        const allowed = await assertTeacherAssignedToSection(req.user.id, assessment.section_id);
        if (!allowed) return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      const fields = ['name','date','max_marks','weightage','term','notes','subject_id'];
      const sets = [];
      const params = [];
      let i = 1;
      for (const f of fields) {
        if (f in req.body) {
          sets.push(`${f} = $${i++}`);
          params.push(req.body[f]);
        }
      }
      if (sets.length === 0) return res.json({ success: true, message: 'No changes', data: assessment });
      params.push(id);

      const updated = await db.query(
        `UPDATE assessments SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${i} RETURNING *`,
        params
      );

      try {
        await db.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
           VALUES ($1,$2,$3,$4,$5)`,
          [req.user.id, 'update_assessment', 'assessment', id, JSON.stringify(req.body)]
        );
      } catch (e) {}

      res.json({ success: true, message: 'Assessment updated', data: updated.rows[0] });
    } catch (err) {
      console.error('updateAssessment error:', err);
      res.status(500).json({ success: false, message: 'Failed to update assessment' });
    }
  },

  // POST /assessments/:id/lock
  async lockAssessment(req, res) {
    try {
      const { id } = req.params;
      const r = await db.query('SELECT * FROM assessments WHERE id = $1', [id]);
      if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Assessment not found' });
      const a = r.rows[0];
      if (a.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft assessments can be locked' });

      if (req.user.user_type === 'teacher') {
        const allowed = await assertTeacherAssignedToSection(req.user.id, a.section_id);
        if (!allowed) return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      const updated = await db.query(
        `UPDATE assessments SET locked_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
      );

      try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4)`, [req.user.id,'lock_assessment','assessment',id]); } catch (e) {}

      res.json({ success: true, message: 'Assessment locked', data: updated.rows[0] });
    } catch (err) {
      console.error('lockAssessment error:', err);
      res.status(500).json({ success: false, message: 'Failed to lock assessment' });
    }
  },

  // POST /assessments/:id/marks/bulk
  async upsertMarksBulk(req, res) {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      const { rows = [], idempotencyKey } = req.body || {};
      if (!Array.isArray(rows)) return res.status(400).json({ success: false, message: 'rows must be an array' });

      // Idempotency
      if (idempotencyKey) {
        const existing = await db.query(`SELECT response_hash FROM idempotent_requests WHERE idempotency_key = $1 AND endpoint = $2 AND user_id = $3`, [idempotencyKey, 'marks_bulk', req.user.id]);
        if (existing.rows.length > 0) {
          return res.json({ success: true, message: 'Already processed', data: { idempotent: true } });
        }
      }

      const a = await db.query('SELECT * FROM assessments WHERE id = $1', [id]);
      if (a.rows.length === 0) return res.status(404).json({ success: false, message: 'Assessment not found' });
      const assessment = a.rows[0];
      if (assessment.status !== 'draft') return res.status(400).json({ success: false, message: 'Cannot modify marks after publish' });
      if (req.user.user_type === 'teacher') {
        const allowed = await assertTeacherAssignedToSection(req.user.id, assessment.section_id);
        if (!allowed) return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      // Validate rows
      for (const r of rows) {
        if (!r.studentId) return res.status(400).json({ success: false, message: 'studentId is required in rows' });
        if (r.absent) continue;
        if (r.marks == null) continue; // allow null in draft
        if (typeof r.marks !== 'number' || r.marks < 0 || r.marks > assessment.max_marks) {
          return res.status(400).json({ success: false, message: `Invalid marks for student ${r.studentId}` });
        }
      }

      await client.query('BEGIN');

      let updated = 0;
      for (const r of rows) {
        await client.query(
          `INSERT INTO marks (assessment_id, student_id, marks, absent, remarks, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (assessment_id, student_id)
           DO UPDATE SET marks = EXCLUDED.marks, absent = EXCLUDED.absent, remarks = EXCLUDED.remarks, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
          [id, r.studentId, r.absent ? null : r.marks, !!r.absent, r.remarks || null, req.user.id]
        );
        updated++;
      }

      if (idempotencyKey) {
        const responseHash = sha256(JSON.stringify({ updated }));
        await client.query(
          `INSERT INTO idempotent_requests (idempotency_key, endpoint, user_id, response_hash)
           VALUES ($1,$2,$3,$4) ON CONFLICT (idempotency_key) DO NOTHING`,
          [idempotencyKey, 'marks_bulk', req.user.id, responseHash]
        );
      }

      await client.query('COMMIT');

      try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)`, [req.user.id,'upsert_marks','assessment',id, JSON.stringify({ updated })]); } catch (e) {}

      res.json({ success: true, message: 'Marks saved', data: { updated } });
    } catch (err) {
      await (async () => { try { await db.query('ROLLBACK'); } catch(e) {} })();
      console.error('upsertMarksBulk error:', err);
      res.status(500).json({ success: false, message: 'Failed to save marks' });
    } finally {
      client.release();
    }
  },

  // GET /assessments/:id/marks
  async getMarks(req, res) {
    try {
      const { id } = req.params;
      const a = await db.query('SELECT * FROM assessments WHERE id = $1', [id]);
      if (a.rows.length === 0) return res.status(404).json({ success: false, message: 'Assessment not found' });
      const assessment = a.rows[0];
      if (req.user.user_type === 'teacher') {
        const allowed = await assertTeacherAssignedToSection(req.user.id, assessment.section_id);
        if (!allowed) return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      const m = await db.query(
        `SELECT m.student_id, m.marks, m.absent, m.remarks, m.updated_at
         FROM marks m WHERE m.assessment_id = $1`,
        [id]
      );
      res.json({ success: true, message: 'Marks retrieved', data: { rows: m.rows } });
    } catch (err) {
      console.error('getMarks error:', err);
      res.status(500).json({ success: false, message: 'Failed to get marks' });
    }
  },

  // POST /assessments/:id/publish
  async publishAssessment(req, res) {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      const { notify = false, channels = [], audience = 'all', attachReport = false, message } = req.body || {};

      const a = await db.query('SELECT * FROM assessments WHERE id = $1', [id]);
      if (a.rows.length === 0) return res.status(404).json({ success: false, message: 'Assessment not found' });
      const assessment = a.rows[0];
      if (assessment.status !== 'draft') return res.status(400).json({ success: false, message: 'Already published' });
      if (req.user.user_type === 'teacher') {
        const allowed = await assertTeacherAssignedToSection(req.user.id, assessment.section_id);
        if (!allowed) return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      await client.query('BEGIN');

      const published = await client.query(
        `UPDATE assessments SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
      );

      // Write denormalized result view per student
      const marks = await client.query(`SELECT student_id, marks, absent FROM marks WHERE assessment_id = $1`, [id]);
      for (const r of marks.rows) {
        await client.query(
          `INSERT INTO results_denorm (assessment_id, student_id, section_id, subject_id, marks, absent)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (assessment_id, student_id) DO UPDATE SET marks = EXCLUDED.marks, absent = EXCLUDED.absent`,
          [id, r.student_id, assessment.section_id, assessment.subject_id, r.marks, r.absent]
        );
      }

      // Optional: generate report
      let reportRecord = null;
      if (attachReport) {
        const reportPathDir = path.join(process.cwd(), 'uploads', 'reports');
        fs.mkdirSync(reportPathDir, { recursive: true });
        const filePath = path.join(reportPathDir, `assessment_${id}.csv`);
        const rows = marks.rows.map(r => `${r.student_id},${r.marks ?? ''},${r.absent ? 'ABSENT' : ''}`).join('\n');
        fs.writeFileSync(filePath, `student_id,marks,absent\n${rows}`);
        const url = `/uploads/reports/assessment_${id}.csv`;
        const rep = await client.query(
          `INSERT INTO reports (assessment_id, type, url, checksum)
           VALUES ($1,'CSV',$2,$3) RETURNING *`,
          [id, url, sha256(fs.readFileSync(filePath))]
        );
        reportRecord = rep.rows[0];
      }

      // Publication record
      const pub = await client.query(
        `INSERT INTO publications (assessment_id, scope, status, counts)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [id, audience === 'all' ? 'all' : 'partial', notify ? 'queued' : 'skipped', JSON.stringify({ total: marks.rows.length })]
      );

      await client.query('COMMIT');

      try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4)`, [req.user.id,'publish_assessment','assessment',id]); } catch (e) {}

      res.json({ success: true, message: 'Assessment published', data: { assessment: published.rows[0], report: reportRecord, publication: pub.rows[0] } });
    } catch (err) {
      await (async () => { try { await db.query('ROLLBACK'); } catch(e) {} })();
      console.error('publishAssessment error:', err);
      res.status(500).json({ success: false, message: 'Failed to publish assessment' });
    } finally {
      client.release();
    }
  },

  // POST /assessments/:id/report
  async generateReport(req, res) {
    try {
      const { id } = req.params;
      const a = await db.query('SELECT * FROM assessments WHERE id = $1', [id]);
      if (a.rows.length === 0) return res.status(404).json({ success: false, message: 'Assessment not found' });
      const assessment = a.rows[0];
      if (req.user.user_type === 'teacher') {
        const allowed = await assertTeacherAssignedToSection(req.user.id, assessment.section_id);
        if (!allowed) return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      const marks = await db.query(`SELECT student_id, marks, absent FROM marks WHERE assessment_id = $1`, [id]);
      // Compute simple stats
      const scores = marks.rows.filter(r => !r.absent && r.marks != null).map(r => Number(r.marks));
      const avg = scores.length ? scores.reduce((a,b)=>a+b,0) / scores.length : 0;
      const hi = scores.length ? Math.max(...scores) : null;
      const lo = scores.length ? Math.min(...scores) : null;

      const reportPathDir = path.join(process.cwd(), 'uploads', 'reports');
      fs.mkdirSync(reportPathDir, { recursive: true });
      const filePath = path.join(reportPathDir, `assessment_${id}_${Date.now()}.csv`);
      const rows = marks.rows.map(r => `${r.student_id},${r.marks ?? ''},${r.absent ? 'ABSENT' : ''}`).join('\n');
      fs.writeFileSync(filePath, `student_id,marks,absent\n${rows}`);
      const url = `/uploads/reports/${path.basename(filePath)}`;
      const rep = await db.query(
        `INSERT INTO reports (assessment_id, type, url, checksum)
         VALUES ($1,'CSV',$2,$3) RETURNING *`,
        [id, url, sha256(fs.readFileSync(filePath))]
      );

      res.json({ success: true, message: 'Report generated', data: { report: rep.rows[0], stats: { average: avg, high: hi, low: lo } } });
    } catch (err) {
      console.error('generateReport error:', err);
      res.status(500).json({ success: false, message: 'Failed to generate report' });
    }
  },

  // GET /assessments/:id/report
  async getReport(req, res) {
    try {
      const { id } = req.params;
      const r = await db.query(`SELECT * FROM reports WHERE assessment_id = $1 ORDER BY generated_at DESC LIMIT 1`, [id]);
      if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Report not found' });
      res.json({ success: true, message: 'Report retrieved', data: r.rows[0] });
    } catch (err) {
      console.error('getReport error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch report' });
    }
  },

  // POST /assessments/:id/notify
  async notify(req, res) {
    try {
      const { id } = req.params;
      const { channels = ['inApp','email'], audience = 'all', message = '' } = req.body || {};
      const a = await db.query('SELECT * FROM assessments WHERE id = $1', [id]);
      if (a.rows.length === 0) return res.status(404).json({ success: false, message: 'Assessment not found' });
      const assessment = a.rows[0];

      if (req.user.user_type === 'teacher') {
        const allowed = await assertTeacherAssignedToSection(req.user.id, assessment.section_id);
        if (!allowed) return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      // Determine recipients (parents of students in section)
      const students = await db.query(
        `SELECT DISTINCT p.user_id as parent_user_id, u.email, s.id as student_id
         FROM section_students ss
         JOIN students s ON ss.student_id = s.id
         JOIN parent_students ps ON ps.student_id = s.id
         JOIN parents p ON p.id = ps.parent_id
         JOIN users u ON u.id = p.user_id
         WHERE ss.section_id = $1 AND ss.status = 'active'`,
        [assessment.section_id]
      );

      const notifications = [];
      for (const rec of students.rows) {
        const email = rec.email;
        const willEmail = channels.includes('email') && email;
        let status = 'queued';
        let providerMessageId = null;
        if (willEmail && (process.env.EMAIL_ENABLED || '').toLowerCase() === 'true') {
          const send = await emailService.transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Assessment Published',
            text: message || 'Your child\'s assessment results are available.',
          }).catch(e => ({ error: e }));
          if (send && send.messageId) {
            status = 'sent';
            providerMessageId = send.messageId;
          } else if (send && send.error) {
            status = 'failed';
          }
        }
        const n = await db.query(
          `INSERT INTO notifications (assessment_id, channel, status, provider_message_id)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [id, willEmail ? 'email' : 'inApp', status, providerMessageId]
        );
        notifications.push(n.rows[0]);
      }

      try { await db.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1,$2,$3,$4,$5)`, [req.user.id,'notify_assessment','assessment',id, JSON.stringify({ channels, audience })]); } catch (e) {}

      res.json({ success: true, message: 'Notifications queued', data: { count: notifications.length } });
    } catch (err) {
      console.error('notify error:', err);
      res.status(500).json({ success: false, message: 'Failed to queue notifications' });
    }
  },

  // GET /assessments/:id/audit
  async getAudit(req, res) {
    try {
      const { id } = req.params;
      const r = await db.query(
        `SELECT id, user_id, action, resource_type, resource_id, details, created_at as at
         FROM audit_logs WHERE resource_type = 'assessment' AND resource_id = $1
         ORDER BY created_at ASC`,
        [id]
      );
      res.json({ success: true, message: 'Audit trail', data: r.rows });
    } catch (err) {
      console.error('getAudit error:', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve audit' });
    }
  }
};


