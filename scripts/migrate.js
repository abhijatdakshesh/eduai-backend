const db = require('../config/database');

// Helper function to get column type
const getColumnType = (columnName) => {
  const columnTypes = {
    phone: 'VARCHAR(20)',
    date_of_birth: 'DATE',
    gender: 'VARCHAR(10)',
    avatar_url: 'VARCHAR(500)',
    is_email_verified: 'BOOLEAN DEFAULT FALSE',
    is_active: 'BOOLEAN DEFAULT TRUE',
    updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  };
  return columnTypes[columnName] || 'TEXT';
};

const createTables = async () => {
  try {
    console.log('🔄 Starting database migration...');

    // Users table (extended from auth system)
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        user_type VARCHAR(20) NOT NULL DEFAULT 'student',
        phone VARCHAR(20),
        date_of_birth DATE,
        gender VARCHAR(10),
        avatar_url VARCHAR(500),
        is_email_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add missing columns to users table if they don't exist
    const userColumns = ['phone', 'date_of_birth', 'gender', 'avatar_url', 'is_email_verified', 'is_active', 'updated_at'];
    for (const column of userColumns) {
      try {
        await db.query(`ALTER TABLE users ADD COLUMN ${column} ${getColumnType(column)}`);
        console.log(`Added ${column} column to users table`);
      } catch (error) {
        if (error.code === '42701') {
          console.log(`${column} column already exists in users table`);
        } else {
          throw error;
        }
      }
    }

    // Departments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(10) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Courses table
    await db.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        credits INTEGER NOT NULL,
        department_id UUID REFERENCES departments(id),
        instructor_id UUID REFERENCES users(id),
        max_enrollment INTEGER DEFAULT 50,
        current_enrollment INTEGER DEFAULT 0,
        semester VARCHAR(20) NOT NULL,
        year INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add year column if it doesn't exist
    try {
      await db.query('ALTER TABLE courses ADD COLUMN year INTEGER');
      console.log('Added year column to courses table');
    } catch (error) {
      if (error.code === '42701') {
        console.log('Year column already exists in courses table');
      } else {
        throw error;
      }
    }

    // Enrollments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES users(id),
        course_id UUID REFERENCES courses(id),
        enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'enrolled',
        grade VARCHAR(2),
        points DECIMAL(3,2),
        UNIQUE(student_id, course_id)
      );
    `);

    // Schedule table
    await db.query(`
      CREATE TABLE IF NOT EXISTS schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID REFERENCES courses(id),
        day_of_week INTEGER NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        room VARCHAR(50),
        building VARCHAR(50),
        class_type VARCHAR(20) DEFAULT 'lecture',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Jobs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        company VARCHAR(200) NOT NULL,
        location VARCHAR(200),
        job_type VARCHAR(20) NOT NULL,
        salary_min INTEGER,
        salary_max INTEGER,
        description TEXT,
        requirements TEXT,
        posted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deadline DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_by UUID REFERENCES users(id)
      );
    `);

    // Job Applications table
    await db.query(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID REFERENCES jobs(id),
        student_id UUID REFERENCES users(id),
        application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        resume_url VARCHAR(500),
        cover_letter TEXT,
        UNIQUE(job_id, student_id)
      );
    `);

    // Fees table
    await db.query(`
      CREATE TABLE IF NOT EXISTS fees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES users(id),
        semester VARCHAR(20) NOT NULL,
        year INTEGER NOT NULL,
        tuition_fee DECIMAL(10,2) NOT NULL,
        library_fee DECIMAL(10,2) DEFAULT 0,
        lab_fee DECIMAL(10,2) DEFAULT 0,
        activity_fee DECIMAL(10,2) DEFAULT 0,
        total_fee DECIMAL(10,2) NOT NULL,
        paid_amount DECIMAL(10,2) DEFAULT 0,
        due_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Payments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fee_id UUID REFERENCES fees(id),
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        transaction_id VARCHAR(100),
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'completed',
        notes TEXT
      );
    `);

    // Scholarships table
    await db.query(`
      CREATE TABLE IF NOT EXISTS scholarships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        amount DECIMAL(10,2) NOT NULL,
        eligibility_criteria TEXT,
        application_deadline DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Scholarship Applications table
    await db.query(`
      CREATE TABLE IF NOT EXISTS scholarship_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scholarship_id UUID REFERENCES scholarships(id),
        student_id UUID REFERENCES users(id),
        application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        documents_url VARCHAR(500),
        UNIQUE(scholarship_id, student_id)
      );
    `);

    // Results table
    await db.query(`
      CREATE TABLE IF NOT EXISTS results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES users(id),
        course_id UUID REFERENCES courses(id),
        semester VARCHAR(20) NOT NULL,
        year INTEGER NOT NULL,
        grade VARCHAR(2),
        points DECIMAL(3,2),
        credits INTEGER,
        is_published BOOLEAN DEFAULT FALSE,
        published_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Campus Services table
    await db.query(`
      CREATE TABLE IF NOT EXISTS campus_services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL,
        location VARCHAR(200),
        contact_info TEXT,
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Service Bookings table
    await db.query(`
      CREATE TABLE IF NOT EXISTS service_bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id UUID REFERENCES campus_services(id),
        student_id UUID REFERENCES users(id),
        booking_date DATE NOT NULL,
        booking_time TIME NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Chat History table (for AI Assistant)
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        message TEXT NOT NULL,
        response TEXT,
        message_type VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Notifications table
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // User Sessions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        refresh_token TEXT NOT NULL,
        device_id VARCHAR(100) NOT NULL,
        device_type VARCHAR(50),
        os_version VARCHAR(50),
        app_version VARCHAR(20),
        ip_address INET,
        user_agent TEXT,
        country VARCHAR(100),
        state VARCHAR(100),
        city VARCHAR(100),
        timezone VARCHAR(100),
        last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT TRUE
      );
    `);

    // Audit Logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id UUID,
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        device_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Verification Tokens table
    await db.query(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        token VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Parents table (extended)
    await db.query(`
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

    // Ensure new columns exist on parents table (if older schema was applied)
    const parentNewCols = [
      'primary_phone VARCHAR(20)',
      'secondary_phone VARCHAR(20)',
      'address_line1 VARCHAR(200)',
      'address_line2 VARCHAR(200)',
      'city VARCHAR(100)',
      'state VARCHAR(100)',
      'postal_code VARCHAR(20)',
      'country VARCHAR(100)',
      "verification_status VARCHAR(20) DEFAULT 'unverified'"
    ];
    for (const def of parentNewCols) {
      const col = def.split(' ')[0];
      try {
        await db.query(`ALTER TABLE parents ADD COLUMN ${def}`);
        console.log(`Added parents.${col}`);
      } catch (error) {
        if (error.code !== '42701') { // duplicate_column
          throw error;
        }
      }
    }

    // Parent-Students junction table
    await db.query(`
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

    // Students table
    await db.query(`
      CREATE TABLE IF NOT EXISTS students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        student_id VARCHAR(20) UNIQUE,
        grade_level VARCHAR(10),
        enrollment_date DATE,
        parent_id UUID REFERENCES parents(id),
        academic_year VARCHAR(10),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Teachers table
    await db.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        teacher_id VARCHAR(20) UNIQUE,
        department VARCHAR(50),
        specialization TEXT,
        hire_date DATE,
        qualification TEXT,
        experience_years INTEGER,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Rooms table
    await db.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_number VARCHAR(20) UNIQUE NOT NULL,
        building VARCHAR(50),
        capacity INTEGER,
        room_type VARCHAR(20) DEFAULT 'classroom',
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Classes table
    await db.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        grade_level VARCHAR(10),
        academic_year VARCHAR(10),
        teacher_id UUID REFERENCES teachers(id),
        room_id UUID REFERENCES rooms(id),
        max_students INTEGER DEFAULT 30,
        current_students INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Optional: de-dup safeguard
    // 1) Collapse duplicates by (name, academic_year, teacher_id) keeping the earliest record
    await db.query(`
      WITH dups AS (
        SELECT id, name, academic_year, teacher_id, created_at,
               ROW_NUMBER() OVER (PARTITION BY name, academic_year, teacher_id ORDER BY created_at NULLS FIRST, id) AS rn
        FROM classes
        WHERE teacher_id IS NOT NULL
      ),
      canon AS (
        SELECT name, academic_year, teacher_id, id AS canon_id
        FROM dups
        WHERE rn = 1
      ),
      moved AS (
        UPDATE student_classes sc
        SET class_id = c.canon_id
        FROM dups d
        JOIN canon c
          ON d.name = c.name AND d.academic_year = c.academic_year AND d.teacher_id = c.teacher_id
        WHERE d.rn > 1 AND sc.class_id = d.id
        RETURNING sc.id
      )
      DELETE FROM classes
      WHERE id IN (SELECT id FROM dups WHERE rn > 1);
    `);

    // 2) Create unique index after cleanup
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_class_name_year_teacher ON classes (name, academic_year, teacher_id)`);

    // Student Classes table
    await db.query(`
      CREATE TABLE IF NOT EXISTS student_classes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES students(id),
        class_id UUID REFERENCES classes(id),
        enrollment_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, class_id)
      );
    `);

    // Student Courses table
    await db.query(`
      CREATE TABLE IF NOT EXISTS student_courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES students(id),
        course_id UUID REFERENCES courses(id),
        enrollment_date DATE DEFAULT CURRENT_DATE,
        grade VARCHAR(2),
        points DECIMAL(3,2),
        status VARCHAR(20) DEFAULT 'enrolled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, course_id)
      );
    `);

    // Announcements table (extended)
    await db.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        body TEXT NOT NULL,
        attachments JSONB DEFAULT '[]'::jsonb,
        scope_type VARCHAR(20) NOT NULL DEFAULT 'global',
        scope_id UUID,
        audience VARCHAR(20) NOT NULL DEFAULT 'both',
        created_by UUID REFERENCES teachers(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        pinned BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE
      );
    `);

    // Backward-compatibility: add new columns if legacy schema exists
    const announcementNewCols = [
      "body TEXT",
      "attachments JSONB DEFAULT '[]'::jsonb",
      "scope_type VARCHAR(20) NOT NULL DEFAULT 'global'",
      "scope_id UUID",
      "audience VARCHAR(20) NOT NULL DEFAULT 'both'",
      "created_by UUID REFERENCES teachers(id)",
      "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      "expires_at TIMESTAMP",
      "pinned BOOLEAN DEFAULT FALSE",
      "is_active BOOLEAN DEFAULT TRUE"
    ];
    for (const def of announcementNewCols) {
      const col = def.split(' ')[0];
      try {
        await db.query(`ALTER TABLE announcements ADD COLUMN ${def}`);
        console.log(`Added announcements.${col}`);
      } catch (error) {
        if (error.code !== '42701') { // duplicate_column
          throw error;
        }
      }
    }

    // Replace legacy content column into body if necessary (best-effort)
    try {
      await db.query(`UPDATE announcements SET body = COALESCE(body, content) WHERE body IS NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='content')`);
    } catch (error) {
      // ignore if content doesn't exist
    }

    // Make legacy content column nullable to avoid NOT NULL violations
    try {
      await db.query(`ALTER TABLE announcements ALTER COLUMN content DROP NOT NULL`);
    } catch (error) {
      // ignore if column missing or already nullable
    }

    // Indexes
    await db.query(`CREATE INDEX IF NOT EXISTS idx_announcements_scope ON announcements(scope_type, scope_id, created_at DESC)`);

    // Announcement reads table
    await db.query(`
      CREATE TABLE IF NOT EXISTS announcement_reads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(announcement_id, user_id)
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id)`);

    // Attendance table
    await db.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES students(id),
        class_id UUID REFERENCES classes(id),
        date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'present',
        notes TEXT,
        recorded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, class_id, date)
      );
    `);

    // Indexes and constraints for attendance
    await db.query(`CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);`);
    // Add check constraint for status values if not exists
    try {
      await db.query(`ALTER TABLE attendance ADD CONSTRAINT attendance_status_chk CHECK (status IN ('present','absent','late','excused'))`);
    } catch (error) {
      if (error.code !== '42710') { // duplicate_object
        throw error;
      }
    }

    // Insert default departments
    await db.query(`
      INSERT INTO departments (name, code, description) VALUES
      ('Computer Science', 'CS', 'Department of Computer Science and Engineering'),
      ('Electrical Engineering', 'EE', 'Department of Electrical Engineering'),
      ('Mechanical Engineering', 'ME', 'Department of Mechanical Engineering'),
      ('Business Administration', 'BA', 'Department of Business Administration'),
      ('Arts and Humanities', 'AH', 'Department of Arts and Humanities')
      ON CONFLICT (code) DO NOTHING;
    `);

    // Insert default campus services
    await db.query(`
      INSERT INTO campus_services (name, description, category, location, contact_info) VALUES
      ('Hostel Services', 'Student accommodation and housing services', 'Housing', 'Main Campus', 'hostel@eduai.com'),
      ('Transportation', 'Campus shuttle and transportation services', 'Transport', 'Main Gate', 'transport@eduai.com'),
      ('Dining Services', 'Cafeteria and food services', 'Food', 'Student Center', 'dining@eduai.com'),
      ('Health Center', 'Medical and health services', 'Health', 'Health Building', 'health@eduai.com'),
      ('Library Services', 'Library and study resources', 'Academic', 'Library Building', 'library@eduai.com'),
      ('IT Support', 'Technical support and computer services', 'Technology', 'IT Building', 'itsupport@eduai.com')
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ Database migration completed successfully!');
    console.log('📊 Created tables: users, departments, courses, enrollments, schedule, jobs, job_applications, fees, payments, scholarships, scholarship_applications, results, campus_services, service_bookings, chat_history, notifications, user_sessions, audit_logs, verification_tokens, parents, students, teachers, rooms, classes, student_classes, student_courses, announcements, attendance');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
  createTables().then(() => {
  console.log('🎉 Migration script completed!');
    process.exit(0);
  }).catch((error) => {
  console.error('💥 Migration script failed:', error);
    process.exit(1);
  });