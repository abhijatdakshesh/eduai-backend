const db = require('../config/database');

async function run() {
  console.log('[migration] Starting sections year/semester migration');
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Add columns year (1-4) and semester (1-8) if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'sections' AND column_name = 'year'
        ) THEN
          ALTER TABLE sections ADD COLUMN year INTEGER;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'sections' AND column_name = 'semester'
        ) THEN
          ALTER TABLE sections ADD COLUMN semester INTEGER;
        END IF;
      END$$;
    `);

    // Add constraints for ranges
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'sections_year_check'
        ) THEN
          ALTER TABLE sections ADD CONSTRAINT sections_year_check CHECK (year IS NULL OR (year >= 1 AND year <= 4));
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'sections_semester_check'
        ) THEN
          ALTER TABLE sections ADD CONSTRAINT sections_semester_check CHECK (semester IS NULL OR (semester >= 1 AND semester <= 8));
        END IF;
      END$$;
    `);

    // Unique constraint on (department_id, year, semester, name)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uniq_sections_dept_year_sem_name'
        ) THEN
          ALTER TABLE sections ADD CONSTRAINT uniq_sections_dept_year_sem_name UNIQUE (department_id, year, semester, name);
        END IF;
      END$$;
    `);

    // Helpful indexes
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'i' AND c.relname = 'idx_sections_dept_year_semester'
        ) THEN
          CREATE INDEX idx_sections_dept_year_semester ON sections(department_id, year, semester);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'i' AND c.relname = 'idx_sections_dept_academic_year'
        ) THEN
          CREATE INDEX idx_sections_dept_academic_year ON sections(department_id, academic_year);
        END IF;
      END$$;
    `);

    // Enforce uniqueness on join tables
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uniq_section_students_section_student'
        ) THEN
          ALTER TABLE section_students ADD CONSTRAINT uniq_section_students_section_student UNIQUE (section_id, student_id);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uniq_section_teachers_section_teacher'
        ) THEN
          ALTER TABLE section_teachers ADD CONSTRAINT uniq_section_teachers_section_teacher UNIQUE (section_id, teacher_id);
        END IF;
      END$$;
    `);

    await client.query('COMMIT');
    console.log('[migration] Sections year/semester migration completed');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration] Failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

run();


