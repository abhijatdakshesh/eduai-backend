const db = require('../config/database');

const seedTeacherAttendanceData = async () => {
  try {
    console.log('🌱 Seeding teacher attendance flow data...');

    // Get first department
    const departments = await db.query('SELECT id, name FROM departments ORDER BY name LIMIT 1');
    if (departments.rows.length === 0) {
      throw new Error('No departments found. Please run the main migration first.');
    }
    const department = departments.rows[0];
    console.log(`Using department: ${department.name}`);

    // Create sections for the department if they don't exist
    const sections = ['A', 'B', 'C', 'D'];
    const sectionIds = [];
    
    for (const sectionName of sections) {
      const sectionResult = await db.query(`
        INSERT INTO sections (name, department_id, academic_year)
        VALUES ($1, $2, '2024-25')
        ON CONFLICT (name, department_id, academic_year) DO NOTHING
        RETURNING id
      `, [sectionName, department.id]);
      
      if (sectionResult.rows.length > 0) {
        sectionIds.push({ id: sectionResult.rows[0].id, name: sectionName });
        console.log(`✅ Created section: ${sectionName}`);
      } else {
        // Get existing section
        const existingSection = await db.query(`
          SELECT id FROM sections 
          WHERE name = $1 AND department_id = $2 AND academic_year = '2024-25'
        `, [sectionName, department.id]);
        if (existingSection.rows.length > 0) {
          sectionIds.push({ id: existingSection.rows[0].id, name: sectionName });
          console.log(`✅ Found existing section: ${sectionName}`);
        }
      }
    }

    // Create sample students if they don't exist
    const sampleStudents = [
      { first_name: 'Alice', last_name: 'Johnson', student_id: 'S001', email: 'alice.johnson@student.edu' },
      { first_name: 'Bob', last_name: 'Smith', student_id: 'S002', email: 'bob.smith@student.edu' },
      { first_name: 'Carol', last_name: 'Davis', student_id: 'S003', email: 'carol.davis@student.edu' },
      { first_name: 'David', last_name: 'Wilson', student_id: 'S004', email: 'david.wilson@student.edu' },
      { first_name: 'Eva', last_name: 'Brown', student_id: 'S005', email: 'eva.brown@student.edu' },
      { first_name: 'Frank', last_name: 'Miller', student_id: 'S006', email: 'frank.miller@student.edu' },
      { first_name: 'Grace', last_name: 'Taylor', student_id: 'S007', email: 'grace.taylor@student.edu' },
      { first_name: 'Henry', last_name: 'Anderson', student_id: 'S008', email: 'henry.anderson@student.edu' }
    ];

    const studentIds = [];
    
    for (const studentData of sampleStudents) {
      // Create user first
      const userResult = await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, user_type, is_active)
        VALUES ($1, $2, $3, $4, 'student', true)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `, [studentData.email, 'hashed_password_placeholder', studentData.first_name, studentData.last_name]);
      
      let userId;
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
        console.log(`✅ Created user: ${studentData.first_name} ${studentData.last_name}`);
      } else {
        // Get existing user
        const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [studentData.email]);
        userId = existingUser.rows[0].id;
        console.log(`✅ Found existing user: ${studentData.first_name} ${studentData.last_name}`);
      }

      // Create student record
      const studentResult = await db.query(`
        INSERT INTO students (user_id, student_id, grade_level, enrollment_date, academic_year, status)
        VALUES ($1, $2, 'Grade 10', CURRENT_DATE, '2024-25', 'active')
        ON CONFLICT (student_id) DO NOTHING
        RETURNING id
      `, [userId, studentData.student_id]);
      
      if (studentResult.rows.length > 0) {
        studentIds.push({ id: studentResult.rows[0].id, student_id: studentData.student_id, name: `${studentData.first_name} ${studentData.last_name}` });
        console.log(`✅ Created student: ${studentData.student_id} - ${studentData.first_name} ${studentData.last_name}`);
      } else {
        // Get existing student
        const existingStudent = await db.query('SELECT id FROM students WHERE student_id = $1', [studentData.student_id]);
        studentIds.push({ id: existingStudent.rows[0].id, student_id: studentData.student_id, name: `${studentData.first_name} ${studentData.last_name}` });
        console.log(`✅ Found existing student: ${studentData.student_id} - ${studentData.first_name} ${studentData.last_name}`);
      }
    }

    // Assign students to sections (distribute evenly)
    for (let i = 0; i < studentIds.length; i++) {
      const student = studentIds[i];
      const sectionIndex = i % sectionIds.length;
      const section = sectionIds[sectionIndex];
      
      await db.query(`
        INSERT INTO section_students (section_id, student_id, enrollment_date, status)
        VALUES ($1, $2, CURRENT_DATE, 'active')
        ON CONFLICT (section_id, student_id) DO NOTHING
      `, [section.id, student.id]);
      
      console.log(`✅ Assigned ${student.name} (${student.student_id}) to section ${section.name}`);
    }

    console.log('\n🎉 Teacher attendance flow data seeded successfully!');
    console.log(`📊 Created/Updated:`);
    console.log(`  - ${sectionIds.length} sections (A, B, C, D)`);
    console.log(`  - ${studentIds.length} students`);
    console.log(`  - Student-section assignments`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
};

// Run seeding
seedTeacherAttendanceData().then(() => {
  console.log('\n✅ Teacher attendance data seeding completed!');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Teacher attendance data seeding failed:', error);
  process.exit(1);
});
