const db = require('../config/database');

async function ensureTable(sql) {
  try {
    await db.query(sql);
  } catch (error) {
    // 42P07: duplicate_table
    if (error && error.code !== '42P07') {
      throw error;
    }
  }
}

async function run() {
  console.log('🔧 Repairing parent announcements prerequisites...');

  // Extensions
  await ensureTable('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  // Parents table
  await ensureTable(`
    CREATE TABLE IF NOT EXISTS parents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      parent_id VARCHAR(20) UNIQUE,
      primary_phone VARCHAR(20),
      secondary_phone VARCHAR(20),
      address_line1 VARCHAR(200),
      address_line2 VARCHAR(200),
      city VARCHAR(100),
      state VARCHAR(100),
      postal_code VARCHAR(20),
      country VARCHAR(100),
      verification_status VARCHAR(20) DEFAULT 'unverified',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Parent-Students join table
  await ensureTable(`
    CREATE TABLE IF NOT EXISTS parent_students (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
      student_id UUID REFERENCES students(id) ON DELETE CASCADE,
      relationship VARCHAR(20) DEFAULT 'guardian',
      is_primary BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(parent_id, student_id)
    );
  `);

  // Announcements (minimal columns compatible with controllers)
  await ensureTable(`
    CREATE TABLE IF NOT EXISTS announcements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(200) NOT NULL,
      body TEXT NOT NULL,
      attachments JSONB DEFAULT '[]'::jsonb,
      scope_type VARCHAR(20) NOT NULL DEFAULT 'global',
      scope_id UUID,
      audience VARCHAR(20) NOT NULL DEFAULT 'both',
      created_by UUID,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      pinned BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE
    );
  `);

  // Announcement reads
  await ensureTable(`
    CREATE TABLE IF NOT EXISTS announcement_reads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(announcement_id, user_id)
    );
  `);

  await ensureTable(`CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id)`);

  // Create parent profile for parent@eduai.com if missing
  const parentUser = await db.query('SELECT id FROM users WHERE email = $1', ['parent@eduai.com']);
  if (parentUser.rows.length === 0) {
    console.log('⚠️ parent@eduai.com user not found. Skipping profile/link.');
    return;
  }
  const parentUserId = parentUser.rows[0].id;

  let parent = await db.query('SELECT id FROM parents WHERE user_id = $1', [parentUserId]);
  let parentId;
  if (parent.rows.length === 0) {
    const created = await db.query(
      `INSERT INTO parents (user_id, parent_id, primary_phone, city, state, country, verification_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [parentUserId, 'P100', '+1234567895', 'New York', 'NY', 'USA', 'verified']
    );
    parentId = created.rows[0].id;
    console.log('✅ Created parent profile');
  } else {
    parentId = parent.rows[0].id;
    console.log('✅ Found existing parent profile');
  }

  // Link to student@eduai.com if possible
  const studentUser = await db.query('SELECT id FROM users WHERE email = $1', ['student@eduai.com']);
  if (studentUser.rows.length > 0) {
    const studentEntity = await db.query('SELECT id FROM students WHERE user_id = $1', [studentUser.rows[0].id]);
    if (studentEntity.rows.length > 0) {
      await db.query(
        `INSERT INTO parent_students (parent_id, student_id, relationship, is_primary)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (parent_id, student_id) DO NOTHING`,
        [parentId, studentEntity.rows[0].id, 'mother', true]
      );
      console.log('✅ Linked parent to student');
    } else {
      console.log('⚠️ No student entity for student@eduai.com');
    }
  } else {
    console.log('⚠️ student@eduai.com user not found');
  }

  console.log('✅ Repair completed');
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('Repair failed:', err);
  process.exit(1);
});


