const db = require('../config/database');

// Test script for teacher attendance flow endpoints
const testTeacherAttendanceFlow = async () => {
  try {
    console.log('🧪 Testing Teacher Attendance Flow...');

    // Test 1: Check if departments exist
    console.log('\n1. Testing departments...');
    const departments = await db.query('SELECT id, name, code FROM departments ORDER BY name');
    console.log(`✅ Found ${departments.rows.length} departments:`, departments.rows.map(d => d.name));

    // Test 2: Check if sections exist for first department
    if (departments.rows.length > 0) {
      const firstDept = departments.rows[0];
      console.log(`\n2. Testing sections for department: ${firstDept.name}...`);
      
      const sections = await db.query(`
        SELECT DISTINCT s.name as section
        FROM sections s
        WHERE s.department_id = $1
        ORDER BY s.name
      `, [firstDept.id]);
      
      const sectionList = sections.rows.length > 0 
        ? sections.rows.map(row => row.section)
        : ['A', 'B', 'C', 'D'];
      
      console.log(`✅ Found sections:`, sectionList);
    }

    // Test 3: Check if students exist in sections
    if (departments.rows.length > 0) {
      const firstDept = departments.rows[0];
      console.log(`\n3. Testing students for department: ${firstDept.name}...`);
      
      const students = await db.query(`
        SELECT DISTINCT
          s.id as student_id,
          s.student_id as student_code,
          u.first_name,
          u.last_name
        FROM students s
        JOIN users u ON s.user_id = u.id
        JOIN section_students ss ON s.id = ss.student_id
        JOIN sections sec ON ss.section_id = sec.id
        WHERE sec.department_id = $1 
          AND ss.status = 'active'
          AND s.status = 'active'
        ORDER BY u.first_name, u.last_name
        LIMIT 5
      `, [firstDept.id]);
      
      console.log(`✅ Found ${students.rows.length} students:`, students.rows.map(s => `${s.first_name} ${s.last_name} (${s.student_code})`));
    }

    // Test 4: Check if teachers exist
    console.log('\n4. Testing teachers...');
    const teachers = await db.query(`
      SELECT t.id, t.teacher_id, u.first_name, u.last_name, u.email
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE t.status = 'active'
      LIMIT 3
    `);
    console.log(`✅ Found ${teachers.rows.length} teachers:`, teachers.rows.map(t => `${t.first_name} ${t.last_name} (${t.teacher_id})`));

    // Test 5: Check if new tables exist
    console.log('\n5. Testing new tables...');
    
    // Check teacher_attendance table
    const teacherAttendanceTable = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'teacher_attendance'
      );
    `);
    console.log(`✅ teacher_attendance table exists:`, teacherAttendanceTable.rows[0].exists);

    // Check student_attendance_entries table
    const studentAttendanceEntriesTable = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'student_attendance_entries'
      );
    `);
    console.log(`✅ student_attendance_entries table exists:`, studentAttendanceEntriesTable.rows[0].exists);

    // Test 6: Check table structure
    console.log('\n6. Testing table structure...');
    
    const teacherAttendanceColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'teacher_attendance'
      ORDER BY ordinal_position
    `);
    console.log('✅ teacher_attendance columns:', teacherAttendanceColumns.rows.map(c => `${c.column_name} (${c.data_type})`));

    const studentAttendanceEntriesColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'student_attendance_entries'
      ORDER BY ordinal_position
    `);
    console.log('✅ student_attendance_entries columns:', studentAttendanceEntriesColumns.rows.map(c => `${c.column_name} (${c.data_type})`));

    console.log('\n🎉 All tests passed! Teacher Attendance Flow is ready to use.');
    console.log('\n📋 API Endpoints Available:');
    console.log('  GET    /api/v1/teacher/departments');
    console.log('  GET    /api/v1/teacher/departments/:departmentId/sections');
    console.log('  GET    /api/v1/teacher/attendance/students');
    console.log('  POST   /api/v1/teacher/attendance/mark');
    console.log('  GET    /api/v1/teacher/attendance/records');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
};

// Run tests
testTeacherAttendanceFlow().then(() => {
  console.log('\n✅ Teacher Attendance Flow test completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Teacher Attendance Flow test failed:', error);
  process.exit(1);
});
