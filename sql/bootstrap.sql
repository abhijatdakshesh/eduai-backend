-- Bootstrap SQL for Render Postgres (idempotent, no FK dependencies)
-- Safe to run multiple times

-- Enable pgcrypto for gen_random_uuid if not already
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- attendance table (no foreign keys to avoid dependency issues)
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID,
  class_id UUID,
  date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- recorded_by column (no FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'recorded_by'
  ) THEN
    ALTER TABLE attendance ADD COLUMN recorded_by UUID;
  END IF;
END $$;

-- time_slot column (+ partial unique indexes for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'time_slot'
  ) THEN
    ALTER TABLE attendance ADD COLUMN time_slot TEXT NULL;
  END IF;
END $$;

-- Drop legacy unique constraints if any (best-effort)
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'attendance'::regclass AND contype = 'u'
  LOOP
    IF con.conname NOT IN ('uniq_attendance_no_slot', 'uniq_attendance_with_slot') THEN
      BEGIN
        EXECUTE format('ALTER TABLE attendance DROP CONSTRAINT %I;', con.conname);
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- Create partial unique indexes (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uniq_attendance_no_slot'
  ) THEN
    CREATE UNIQUE INDEX uniq_attendance_no_slot
      ON attendance (student_id, class_id, date)
      WHERE time_slot IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uniq_attendance_with_slot'
  ) THEN
    CREATE UNIQUE INDEX uniq_attendance_with_slot
      ON attendance (student_id, class_id, date, time_slot)
      WHERE time_slot IS NOT NULL;
  END IF;
END $$;

-- Optional: teacher_attendance flow tables (no FK)
CREATE TABLE IF NOT EXISTS teacher_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID,
  department_id UUID,
  section VARCHAR(10) NOT NULL,
  time_slot TIME NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(teacher_id, department_id, section, time_slot, date)
);

CREATE TABLE IF NOT EXISTS student_attendance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID,
  student_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(attendance_id, student_id)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher ON teacher_attendance(teacher_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_department ON teacher_attendance(department_id, section, date);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_time ON teacher_attendance(time_slot, date);
CREATE INDEX IF NOT EXISTS idx_student_attendance_entries_attendance ON student_attendance_entries(attendance_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_entries_student ON student_attendance_entries(student_id, created_at DESC);
