const db = require('../config/database');

async function testParentAccess() {
  try {
    console.log('🧪 Testing Parent Access to Attendance Data...\n');

    // Get parent info
    const parent = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, p.id as parent_id, p.parent_id as parent_code
       FROM users u
       JOIN parents p ON p.user_id = u.id
       WHERE u.email = 'testparent@school.com'`
    );

    if (parent.rows.length === 0) {
      console.log('❌ Test parent not found');
      return;
    }

    const parentInfo = parent.rows[0];
    console.log('👤 Test Parent Information:');
    console.log(`   Email: ${parentInfo.email}`);
    console.log(`   Name: ${parentInfo.first_name} ${parentInfo.last_name}`);
    console.log(`   User ID: ${parentInfo.id}`);
    console.log(`   Parent ID: ${parentInfo.parent_id}`);
    console.log(`   Parent Code: ${parentInfo.parent_code}\n`);

    // Get children
    const children = await db.query(
      `SELECT s.id, s.student_id, u.first_name, u.last_name
       FROM parent_students ps
       JOIN students s ON ps.student_id = s.id
       JOIN users u ON s.user_id = u.id
       WHERE ps.parent_id = $1`,
      [parentInfo.parent_id]
    );

    console.log('👨‍🎓 Linked Children:');
    children.rows.forEach(child => {
      console.log(`   - ${child.first_name} ${child.last_name} (${child.student_id}) - ID: ${child.id}`);
    });
    console.log('');

    // Get attendance summary for first child
    if (children.rows.length > 0) {
      const childId = children.rows[0].id;
      const attendanceSummary = await db.query(
        `SELECT status, COUNT(*) as count
         FROM attendance
         WHERE student_id = $1
         GROUP BY status
         ORDER BY count DESC`,
        [childId]
      );

      console.log('📊 Attendance Summary:');
      attendanceSummary.rows.forEach(row => {
        console.log(`   ${row.status}: ${row.count} records`);
      });
      console.log('');

      // Get recent attendance
      const recentAttendance = await db.query(
        `SELECT a.date, a.status, a.notes, c.name as class_name
         FROM attendance a
         JOIN classes c ON a.class_id = c.id
         WHERE a.student_id = $1
         ORDER BY a.date DESC
         LIMIT 5`,
        [childId]
      );

      console.log('📅 Recent Attendance (Last 5 days):');
      recentAttendance.rows.forEach(record => {
        console.log(`   ${record.date}: ${record.status} - ${record.class_name}${record.notes ? ` (${record.notes})` : ''}`);
      });
    }

    console.log('\n✅ Test Parent Setup Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 Login Credentials:');
    console.log('   Email: testparent@school.com');
    console.log('   Password: password123');
    console.log('');
    console.log('📱 Parent Portal Access:');
    console.log('   - Login with the credentials above');
    console.log('   - Navigate to parent portal');
    console.log('   - You should see John Doe (S001) as your child');
    console.log('   - Click on attendance to see the data');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testParentAccess();
