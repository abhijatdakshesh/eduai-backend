const db = require('../config/database');

const createTeacherAttendanceTables = async () => {
  try {
    console.log('🔄 Creating teacher attendance flow tables...');

    // Create teacher_attendance table for department/section/time-based attendance
    await db.query(`
      CREATE TABLE IF NOT EXISTS teacher_attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
        department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
        section VARCHAR(10) NOT NULL,
        time_slot TIME NOT NULL,
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(teacher_id, department_id, section, time_slot, date)
      );
    `);

    // Create student_attendance_entries table for individual student attendance records
    await db.query(`
      CREATE TABLE IF NOT EXISTS student_attendance_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attendance_id UUID REFERENCES teacher_attendance(id) ON DELETE CASCADE,
        student_id UUID REFERENCES students(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'present',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(attendance_id, student_id)
      );
    `);

    // Add indexes for better performance
    await db.query(`CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher ON teacher_attendance(teacher_id, date DESC);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_teacher_attendance_department ON teacher_attendance(department_id, section, date);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_teacher_attendance_time ON teacher_attendance(time_slot, date);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_student_attendance_entries_attendance ON student_attendance_entries(attendance_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_student_attendance_entries_student ON student_attendance_entries(student_id, created_at DESC);`);

    // Add check constraint for status values
    try {
      await db.query(`ALTER TABLE student_attendance_entries ADD CONSTRAINT student_attendance_status_chk CHECK (status IN ('present','absent','late','excused'))`);
    } catch (error) {
      if (error.code !== '42710') { // duplicate_object
        throw error;
      }
    }

    // Add check constraint for section values
    try {
      await db.query(`ALTER TABLE teacher_attendance ADD CONSTRAINT teacher_attendance_section_chk CHECK (section IN ('A','B','C','D'))`);
    } catch (error) {
      if (error.code !== '42710') { // duplicate_object
        throw error;
      }
    }

    // Add check constraint for time slot (9 AM to 5 PM)
    try {
      await db.query(`ALTER TABLE teacher_attendance ADD CONSTRAINT teacher_attendance_time_chk CHECK (time_slot >= '09:00:00' AND time_slot <= '17:00:00')`);
    } catch (error) {
      if (error.code !== '42710') { // duplicate_object
        throw error;
      }
    }

    console.log('✅ Teacher attendance flow tables created successfully!');
    console.log('📊 Created tables: teacher_attendance, student_attendance_entries');

  } catch (error) {
    console.error('❌ Teacher attendance migration failed:', error);
    throw error;
  }
};

// Run migration
createTeacherAttendanceTables().then(() => {
  console.log('🎉 Teacher attendance migration completed!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Teacher attendance migration failed:', error);
  process.exit(1);
});
