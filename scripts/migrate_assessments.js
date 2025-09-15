const db = require('../config/database');

async function run() {
  try {
    await db.query('BEGIN');

    await db.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await db.query(`
      CREATE TABLE IF NOT EXISTS assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        section_id UUID NOT NULL,
        subject_id UUID NOT NULL,
        name TEXT NOT NULL,
        date DATE NOT NULL,
        max_marks INTEGER NOT NULL CHECK (max_marks > 0),
        weightage INTEGER,
        term TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
        created_by UUID NOT NULL,
        locked_at TIMESTAMPTZ,
        published_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS marks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        student_id UUID NOT NULL,
        marks NUMERIC,
        absent BOOLEAN NOT NULL DEFAULT false,
        remarks TEXT,
        updated_by UUID,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (assessment_id, student_id)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('PDF','CSV')),
        url TEXT NOT NULL,
        checksum TEXT,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS publications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        scope TEXT NOT NULL,
        status TEXT NOT NULL,
        counts JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        provider_message_id TEXT,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id UUID,
        details JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS idempotent_requests (
        idempotency_key TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL,
        user_id UUID NOT NULL,
        response_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS results_denorm (
        assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        student_id UUID NOT NULL,
        section_id UUID NOT NULL,
        subject_id UUID NOT NULL,
        marks NUMERIC,
        absent BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (assessment_id, student_id)
      );
    `);

    await db.query('COMMIT');
    console.log('Migration completed.');
    process.exit(0);
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();


