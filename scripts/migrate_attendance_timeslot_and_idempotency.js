const db = require('../config/database');

async function ensureAttendanceTimeSlotAndIndexes() {
  console.log('Migrating: attendance.time_slot and unique indexes...');

  // 1) Add time_slot column if missing
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance' AND column_name = 'time_slot'
      ) THEN
        ALTER TABLE attendance ADD COLUMN time_slot TEXT NULL;
        RAISE NOTICE 'Added attendance.time_slot column.';
      END IF;
    END $$;
  `);

  // 2) Drop legacy unique constraint on (student_id, class_id, date) if it exists
  const legacyConstraintRes = await db.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'attendance'::regclass
      AND contype = 'u'
  `);
  const legacyNames = legacyConstraintRes.rows.map(r => r.conname);
  for (const name of legacyNames) {
    // Best-effort: if constraint contains the three columns only, drop it
    if (/student_id.*class_id.*date|date.*class_id.*student_id|class_id.*student_id.*date/i.test(name)) {
      try {
        await db.query(`ALTER TABLE attendance DROP CONSTRAINT ${name};`);
        console.log(`Dropped legacy unique constraint: ${name}`);
      } catch (e) {
        console.warn(`Could not drop constraint ${name}:`, e.message);
      }
    }
  }

  // 3) Create partial unique indexes to enforce uniqueness with and without time_slot
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uniq_attendance_no_slot'
      ) THEN
        CREATE UNIQUE INDEX uniq_attendance_no_slot
          ON attendance (student_id, class_id, date)
          WHERE time_slot IS NULL;
        RAISE NOTICE 'Created uniq_attendance_no_slot index.';
      END IF;
    END $$;
  `);

  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uniq_attendance_with_slot'
      ) THEN
        CREATE UNIQUE INDEX uniq_attendance_with_slot
          ON attendance (student_id, class_id, date, time_slot)
          WHERE time_slot IS NOT NULL;
        RAISE NOTICE 'Created uniq_attendance_with_slot index.';
      END IF;
    END $$;
  `);

  console.log('Attendance time_slot and unique indexes migration complete.');
}

async function ensureIdempotencyKeysTable() {
  console.log('Migrating: idempotency_keys table...');
  await db.query(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key VARCHAR(128) PRIMARY KEY,
      user_id UUID NOT NULL,
      endpoint TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  // Helpful index for cleanup by age if you add a job later
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_idem_created_at'
      ) THEN
        CREATE INDEX idx_idem_created_at ON idempotency_keys (created_at);
      END IF;
    END $$;
  `);

  console.log('Idempotency keys table migration complete.');
}

(async () => {
  try {
    await ensureAttendanceTimeSlotAndIndexes();
    await ensureIdempotencyKeysTable();
    console.log('All migrations completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();


