const db = require('../config/database');

const seedStudentDashboardData = async () => {
  try {
    console.log('🎓 Starting student dashboard data seeding...');

    // Get existing student user
    const studentUser = await db.query(`
      SELECT id FROM users WHERE email = 'student@eduai.com' AND user_type = 'student'
    `);
    
    if (studentUser.rows.length === 0) {
      console.log('❌ Student user not found. Please run the main seed script first.');
      return;
    }

    const studentUserId = studentUser.rows[0].id;

    // Create or update student record
    await db.query(`
      INSERT INTO students (user_id, student_id, grade_level, enrollment_date, academic_year, status)
      VALUES ($1, 'S001', '10th', '2024-08-01', '2024-2025', 'active')
      ON CONFLICT (student_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        grade_level = EXCLUDED.grade_level,
        enrollment_date = EXCLUDED.enrollment_date,
        academic_year = EXCLUDED.academic_year,
        status = EXCLUDED.status
      RETURNING id;
    `, [studentUserId]);

    console.log('✅ Updated student record');

    // Get or create courses for the student
    const courses = await db.query(`
      INSERT INTO courses (code, name, description, credits, semester, academic_year, max_enrollment, current_enrollment) VALUES
      ('CS101', 'Introduction to Computer Science', 'Basic programming concepts and problem solving', 3, 'Fall', 2024, 30, 25),
      ('MATH201', 'Calculus I', 'Differential calculus and applications', 4, 'Fall', 2024, 25, 20),
      ('ENG101', 'English Composition', 'Academic writing and critical thinking', 3, 'Fall', 2024, 35, 30),
      ('PHYS101', 'Physics Fundamentals', 'Basic physics concepts and laboratory work', 4, 'Fall', 2024, 28, 22),
      ('HIST101', 'World History', 'Survey of world civilizations', 3, 'Fall', 2024, 40, 35)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        credits = EXCLUDED.credits,
        semester = EXCLUDED.semester,
        academic_year = EXCLUDED.academic_year,
        max_enrollment = EXCLUDED.max_enrollment,
        current_enrollment = EXCLUDED.current_enrollment
      RETURNING id, code, name, credits;
    `);

    console.log('✅ Created/updated courses');

    // Create student enrollments with grades (for GPA calculation)
    await db.query(`
      INSERT INTO enrollments (student_id, course_id, status, grade, points) VALUES
      ($1, $2, 'enrolled', 'A', 4.0),
      ($1, $3, 'enrolled', 'B+', 3.3),
      ($1, $4, 'enrolled', 'A-', 3.7),
      ($1, $5, 'enrolled', 'B', 3.0),
      ($1, $6, 'enrolled', 'A', 4.0)
      ON CONFLICT (student_id, course_id) DO UPDATE SET
        status = EXCLUDED.status,
        grade = EXCLUDED.grade,
        points = EXCLUDED.points;
    `, [studentUserId, courses.rows[0].id, courses.rows[1].id, courses.rows[2].id, courses.rows[3].id, courses.rows[4].id]);

    console.log('✅ Created student enrollments with grades');

    // Create attendance records for the current month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Generate attendance for the current month (assuming 20 school days)
    for (let day = 1; day <= 20; day++) {
      const attendanceDate = new Date(currentYear, currentMonth, day);
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (attendanceDate.getDay() === 0 || attendanceDate.getDay() === 6) {
        continue;
      }

      // Random attendance (85% present rate)
      const isPresent = Math.random() > 0.15;
      const status = isPresent ? 'present' : 'absent';

      // Get the student ID and a class ID for the student
      const studentResult = await db.query(`
        SELECT s.id as student_id, c.id as class_id 
        FROM students s
        LEFT JOIN student_classes sc ON s.id = sc.student_id
        LEFT JOIN classes c ON sc.class_id = c.id
        WHERE s.user_id = $1
        LIMIT 1
      `, [studentUserId]);
      
      if (studentResult.rows.length > 0) {
        const studentId = studentResult.rows[0].student_id;
        const classId = studentResult.rows[0].class_id;
        
        if (classId) {
          await db.query(`
            INSERT INTO attendance (student_id, class_id, date, status, notes)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (student_id, class_id, date) DO UPDATE SET
              status = EXCLUDED.status,
              notes = EXCLUDED.notes;
          `, [studentId, classId, attendanceDate.toISOString().split('T')[0], status, isPresent ? 'Present' : 'Absent']);
        }
      }
    }

    console.log('✅ Created attendance records for current month');

    // Create schedule entries
    await db.query(`
      INSERT INTO schedule (course_id, day_of_week, start_time, end_time, room, building, class_type) VALUES
      ($1, 1, '09:00:00', '10:30:00', '101', 'Computer Science Building', 'lecture'),
      ($1, 3, '14:00:00', '15:30:00', 'Lab A', 'Computer Science Building', 'lab'),
      ($2, 2, '10:00:00', '11:30:00', '201', 'Mathematics Building', 'lecture'),
      ($2, 4, '15:00:00', '16:30:00', '201', 'Mathematics Building', 'tutorial'),
      ($3, 1, '13:00:00', '14:30:00', '301', 'Humanities Building', 'lecture'),
      ($4, 2, '11:00:00', '12:30:00', '401', 'Science Building', 'lecture'),
      ($4, 5, '09:00:00', '11:00:00', 'Lab B', 'Science Building', 'lab'),
      ($5, 3, '16:00:00', '17:30:00', '501', 'Humanities Building', 'lecture')
      ON CONFLICT DO NOTHING;
    `, [courses.rows[0].id, courses.rows[1].id, courses.rows[2].id, courses.rows[3].id, courses.rows[4].id]);

    console.log('✅ Created schedule entries');

    // Create notifications
    await db.query(`
      INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES
      ($1, 'Assignment Due Soon', 'Programming Assignment 2 is due in 3 days', 'assignment', false, NOW()),
      ($1, 'Grade Posted', 'Your Physics lab report grade has been posted', 'grade', false, NOW()),
      ($1, 'Attendance Update', 'You have 95% attendance this month', 'attendance', false, NOW()),
      ($1, 'Course Registration', 'Spring semester registration opens next week', 'registration', false, NOW()),
      ($1, 'Library Reminder', 'You have 2 books due this week', 'library', false, NOW())
      ON CONFLICT DO NOTHING;
    `, [studentUserId]);

    console.log('✅ Created notifications');

    // Create some jobs for the job search feature
    await db.query(`
      INSERT INTO jobs (title, company, location, job_type, salary_min, salary_max, description, requirements, deadline) VALUES
      ('Student Assistant - Computer Lab', 'University IT Department', 'Campus', 'part-time', 12, 15, 'Assist students with computer lab operations', 'Computer Science major preferred', '2024-10-31'),
      ('Library Assistant', 'University Library', 'Campus', 'part-time', 10, 12, 'Help with library operations and student support', 'Good organizational skills', '2024-10-31'),
      ('Research Assistant', 'Computer Science Department', 'Campus', 'part-time', 15, 20, 'Assist with research projects', 'Programming skills required', '2024-10-31'),
      ('Tutor - Mathematics', 'Student Success Center', 'Campus', 'part-time', 15, 18, 'Tutor students in mathematics', 'Strong math background', '2024-10-31'),
      ('Campus Tour Guide', 'Admissions Office', 'Campus', 'part-time', 12, 14, 'Give campus tours to prospective students', 'Good communication skills', '2024-10-31')
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ Created campus jobs');

    // Create some campus services
    await db.query(`
      INSERT INTO campus_services (name, description, category, location, contact_info) VALUES
      ('Health Center', 'Student health services and medical consultations', 'health', 'Student Center', 'health@university.edu'),
      ('Career Counseling', 'Professional career guidance and resume help', 'career', 'Career Center', 'career@university.edu'),
      ('Mental Health Support', 'Counseling and mental health services', 'health', 'Student Center', 'counseling@university.edu'),
      ('IT Support', 'Technical support for students', 'technology', 'IT Building', 'support@university.edu'),
      ('Writing Center', 'Help with academic writing and essays', 'academic', 'Library', 'writing@university.edu')
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ Created campus services');

    // Calculate and display the student's GPA
    const gpaResult = await db.query(`
      SELECT 
        ROUND(AVG(points)::numeric, 2) as gpa,
        COUNT(*) as total_courses
      FROM enrollments 
      WHERE student_id = $1 AND status = 'enrolled'
    `, [studentUserId]);

    const gpa = gpaResult.rows[0].gpa;
    const totalCourses = gpaResult.rows[0].total_courses;

    // Count assignments due (we'll simulate this since assignments table doesn't exist)
    const assignmentsDue = 3; // Simulated value

    // Calculate attendance percentage
    const studentId = (await db.query(`
      SELECT id FROM students WHERE user_id = $1 LIMIT 1
    `, [studentUserId])).rows[0].id;
    
    const attendanceResult = await db.query(`
      SELECT 
        COUNT(*) as total_days,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days
      FROM attendance 
      WHERE student_id = $1 AND date >= DATE_TRUNC('month', CURRENT_DATE)
    `, [studentId]);

    const totalDays = attendanceResult.rows[0].total_days;
    const presentDays = attendanceResult.rows[0].present_days;
    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    console.log(`📊 Student Dashboard Data Summary:`);
    console.log(`   GPA: ${gpa}`);
    console.log(`   Courses Enrolled: ${totalCourses}`);
    console.log(`   Assignments Due: ${assignmentsDue} (simulated)`);
    console.log(`   Attendance: ${attendancePercentage}% (${presentDays}/${totalDays} days)`);

    console.log('🎉 Student dashboard data seeding completed successfully!');

  } catch (error) {
    console.error('❌ Student dashboard seeding failed:', error);
    throw error;
  }
};

// Run seeding
seedStudentDashboardData().then(() => {
  console.log('🎉 Student dashboard seed script completed!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Student dashboard seed script failed:', error);
  process.exit(1);
});
