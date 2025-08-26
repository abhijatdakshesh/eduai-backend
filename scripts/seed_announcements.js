const db = require('../config/database');

async function seed() {
  try {
    console.log('🌱 Seeding announcements...');

    // Pick a teacher
    const t = await db.query("SELECT id, user_id FROM teachers ORDER BY created_at LIMIT 1");
    if (t.rows.length === 0) {
      console.log('⚠️ No teachers found. Skipping.');
      process.exit(0);
    }
    const teacherId = t.rows[0].id;

    // Pick a class
    const c = await db.query("SELECT id, name FROM classes ORDER BY created_at LIMIT 1");
    if (c.rows.length === 0) {
      console.log('⚠️ No classes found. Skipping class-scoped announcements.');
    }

    const inserts = [];

    // Global announcement
    inserts.push(db.query(
      `INSERT INTO announcements (title, body, attachments, scope_type, scope_id, audience, created_by, pinned, is_active)
       VALUES ($1,$2,$3,'global',NULL,'both',$4,true,true)
       ON CONFLICT DO NOTHING`,
      [
        'Welcome Back! Semester Kickoff',
        'Welcome back students and parents! Please review the calendar for important dates.',
        JSON.stringify([{ type: 'link', url: 'https://school.example/calendar' }]),
        teacherId
      ]
    ));

    if (c.rows.length > 0) {
      const classId = c.rows[0].id;
      inserts.push(db.query(
        `INSERT INTO announcements (title, body, attachments, scope_type, scope_id, audience, created_by, pinned, is_active)
         VALUES ($1,$2,$3,'class',$4,'both',$5,false,true)
         ON CONFLICT DO NOTHING`,
        [
          `Class ${c.rows[0].name}: Assignment 1 Posted`,
          'Please check the portal for Assignment 1 details and due dates.',
          JSON.stringify([]),
          classId,
          teacherId
        ]
      ));
    }

    await Promise.all(inserts);
    console.log('✅ Seeded announcements');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();
