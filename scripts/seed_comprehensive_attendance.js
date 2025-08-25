const db = require('../config/database');

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function* lastNDates(n) {
  const today = new Date();
  for (let i = 0; i < n; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    yield d;
  }
}

function getAttendanceStatus(date, studentId) {
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  
  // Different patterns for different students
  const studentHash = studentId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const pattern = studentHash % 3; // 0, 1, or 2
  
  let status;
  
  switch (pattern) {
    case 0: // Good attendance student
      if (dayOfWeek === 1) {
        status = Math.random() < 0.2 ? 'late' : 'present';
      } else {
        status = Math.random() < 0.95 ? 'present' : 'late';
      }
      break;
      
    case 1: // Average attendance student
      if (dayOfWeek === 1) {
        status = Math.random() < 0.4 ? 'late' : 'present';
      } else if (dayOfWeek === 5) {
        status = Math.random() < 0.15 ? 'absent' : 'present';
      } else {
        const rand = Math.random();
        if (rand < 0.85) status = 'present';
        else if (rand < 0.92) status = 'late';
        else status = 'absent';
      }
      break;
      
    case 2: // Struggling attendance student
      if (dayOfWeek === 1) {
        status = Math.random() < 0.6 ? 'late' : 'present';
      } else if (dayOfWeek === 5) {
        status = Math.random() < 0.3 ? 'absent' : 'present';
      } else {
        const rand = Math.random();
        if (rand < 0.75) status = 'present';
        else if (rand < 0.85) status = 'late';
        else status = 'absent';
      }
      break;
  }
  
  // Add some excused absences
  if (status === 'absent' && Math.random() < 0.4) {
    status = 'excused';
  }
  
  return status;
}

function getNotes(status) {
  const notes = {
    'excused': ['Medical appointment', 'Family emergency', 'School event', 'Religious holiday'],
    'late': ['Traffic delay', 'Public transport issue', 'Overslept', 'Weather conditions'],
    'absent': ['Sick day', 'Family vacation', 'Personal emergency', 'Weather conditions'],
    'present': null
  };
  
  if (status === 'present') return null;
  
  const noteArray = notes[status];
  return noteArray[Math.floor(Math.random() * noteArray.length)];
}

async function main() {
  try {
    console.log('🌱 Seeding comprehensive attendance records...');

    // Get all students with their classes
    const students = await db.query(
      `SELECT DISTINCT s.id, s.student_id, u.first_name, u.last_name
       FROM students s 
       JOIN users u ON s.user_id = u.id
       JOIN student_classes sc ON s.id = sc.student_id
       ORDER BY s.student_id`
    );

    if (students.rows.length === 0) {
      console.log('❌ No students found');
      return;
    }

    console.log(`📚 Found ${students.rows.length} students`);

    let totalRecords = 0;

    for (const student of students.rows) {
      console.log(`📖 Processing: ${student.first_name} ${student.last_name} (${student.student_id})`);
      
      // Get classes for this student
      const classes = await db.query(
        `SELECT c.id, c.name 
         FROM student_classes sc
         JOIN classes c ON sc.class_id = c.id
         WHERE sc.student_id = $1`,
        [student.id]
      );

      if (classes.rows.length === 0) {
        console.log(`   ⚠️  No classes found for ${student.first_name}`);
        continue;
      }

      let studentRecords = 0;

      // Create attendance records for the last 20 days
      for (const date of lastNDates(20)) {
        const dateStr = formatDate(date);
        
        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) {
          continue;
        }

        for (const klass of classes.rows) {
          const status = getAttendanceStatus(date, student.student_id);
          const notes = getNotes(status);

          await db.query(
            `INSERT INTO attendance (student_id, class_id, date, status, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (student_id, class_id, date)
             DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes`,
            [student.id, klass.id, dateStr, status, notes, new Date()]
          );
          
          studentRecords++;
          totalRecords++;
        }
      }

      console.log(`   ✅ Added ${studentRecords} records for ${student.first_name}`);
    }

    console.log(`\n🎉 Total attendance records added: ${totalRecords}`);
    
    // Show overall summary
    const summary = await db.query(
      `SELECT status, COUNT(*) as count
       FROM attendance 
       GROUP BY status
       ORDER BY count DESC`
    );

    console.log('\n📊 Overall Attendance Summary:');
    summary.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count} records`);
    });

    // Show student-specific summaries
    console.log('\n📊 Student Attendance Summaries:');
    for (const student of students.rows) {
      const studentSummary = await db.query(
        `SELECT status, COUNT(*) as count
         FROM attendance 
         WHERE student_id = $1 
         GROUP BY status
         ORDER BY count DESC`,
        [student.id]
      );

      console.log(`\n   ${student.first_name} ${student.last_name} (${student.student_id}):`);
      studentSummary.rows.forEach(row => {
        console.log(`     ${row.status}: ${row.count} records`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed comprehensive attendance:', err);
    process.exit(1);
  }
}

main();
