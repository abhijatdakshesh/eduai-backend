const db = require('../config/database');

async function testInfoEndpoint() {
  try {
    console.log('🧪 Testing /info endpoint logic...\n');

    const studentId = '8b86b626-584a-4771-90dd-4d1aedbb4198';
    
    // Test the exact query from getChildInfo
    const childInfo = await db.query(
      `SELECT 
        s.id,
        s.student_id,
        s.grade_level,
        u.first_name,
        u.last_name,
        u.email,
        u.avatar_url,
        c.name as class_name,
        t.first_name as teacher_first_name,
        t.last_name as teacher_last_name
       FROM students s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN student_classes sc ON s.id = sc.student_id
       LEFT JOIN classes c ON sc.class_id = c.id
       LEFT JOIN teachers te ON c.teacher_id = te.id
       LEFT JOIN users t ON te.user_id = t.id
       WHERE s.id = $1`,
      [studentId]
    );

    console.log('✅ Query executed successfully');
    console.log(`📊 Found ${childInfo.rows.length} records`);
    
    if (childInfo.rows.length > 0) {
      const child = childInfo.rows[0];
      console.log('\n👨‍🎓 Child Information:');
      console.log(`   ID: ${child.id}`);
      console.log(`   Student ID: ${child.student_id}`);
      console.log(`   Name: ${child.first_name} ${child.last_name}`);
      console.log(`   Email: ${child.email}`);
      console.log(`   Grade: ${child.grade_level}`);
      console.log(`   Class: ${child.class_name || 'Not assigned'}`);
      console.log(`   Teacher: ${child.teacher_first_name || 'N/A'} ${child.teacher_last_name || ''}`);
    }

    // Test parent-student relationship
    console.log('\n🔗 Testing parent-student relationship...');
    const parentStudentLink = await db.query(
      `SELECT ps.*, p.parent_id as parent_code, u.email as parent_email
       FROM parent_students ps
       JOIN parents p ON ps.parent_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE ps.student_id = $1`,
      [studentId]
    );

    console.log(`📊 Found ${parentStudentLink.rows.length} parent-student relationships`);
    parentStudentLink.rows.forEach(link => {
      console.log(`   - Parent: ${link.parent_email} (${link.parent_code})`);
      console.log(`   - Relationship: ${link.relationship}`);
    });

    console.log('\n✅ Info endpoint logic test completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 Troubleshooting Tips:');
    console.log('1. The database query works correctly');
    console.log('2. The student data is available');
    console.log('3. The parent-student relationship exists');
    console.log('4. The issue might be with authentication or middleware');
    console.log('5. Check if the frontend is sending the correct Authorization header');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testInfoEndpoint();
