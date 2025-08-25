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

async function main() {
  try {
    console.log('🌱 Seeding parent portal attendance records...');

    // Get the specific student that appears in parent logs (John Doe - S001)
    const student = await db.query(
      `SELECT s.id, s.student_id, u.first_name, u.last_name 
       FROM students s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.student_id = 'S001'`
    );

    if (student.rows.length === 0) {
      console.log('❌ Student S001 not found');
      return;
    }

    const studentId = student.rows[0].id;
    console.log(`📚 Adding attendance for: ${student.rows[0].first_name} ${student.rows[0].last_name} (${student.rows[0].student_id})`);

    // Get classes for this student
    const classes = await db.query(
      `SELECT c.id, c.name 
       FROM student_classes sc
       JOIN classes c ON sc.class_id = c.id
       WHERE sc.student_id = $1`,
      [studentId]
    );

    if (classes.rows.length === 0) {
      console.log('❌ No classes found for student');
      return;
    }

    console.log(`📖 Found ${classes.rows.length} classes for student`);

    let totalRecords = 0;

    // Create attendance records for the last 30 days
    for (const date of lastNDates(30)) {
      const dateStr = formatDate(date);
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (date.getDay() === 0 || date.getDay() === 6) {
        continue;
      }

      for (const klass of classes.rows) {
        // Create realistic attendance patterns
        let status;
        const dayOfWeek = date.getDay();
        const dayOfMonth = date.getDate();
        
        // Monday blues - more likely to be late
        if (dayOfWeek === 1) {
          status = Math.random() < 0.3 ? 'late' : 'present';
        }
        // Friday - mostly present
        else if (dayOfWeek === 5) {
          status = Math.random() < 0.1 ? 'absent' : 'present';
        }
        // Mid-month - occasional absences
        else if (dayOfMonth > 10 && dayOfMonth < 20) {
          const rand = Math.random();
          if (rand < 0.85) status = 'present';
          else if (rand < 0.90) status = 'late';
          else status = 'absent';
        }
        // Regular days
        else {
          const rand = Math.random();
          if (rand < 0.92) status = 'present';
          else if (rand < 0.95) status = 'late';
          else status = 'absent';
        }

        // Add some excused absences
        if (status === 'absent' && Math.random() < 0.3) {
          status = 'excused';
        }

        const notes = status === 'excused' ? 'Medical appointment' : 
                     status === 'late' ? 'Traffic delay' : 
                     status === 'absent' ? 'Sick day' : null;

        await db.query(
          `INSERT INTO attendance (student_id, class_id, date, status, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (student_id, class_id, date)
           DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes`,
          [studentId, klass.id, dateStr, status, notes, new Date()]
        );
        
        totalRecords++;
      }
    }

    console.log(`✅ Added ${totalRecords} attendance records for parent portal testing`);
    
    // Show a summary of the attendance
    const summary = await db.query(
      `SELECT status, COUNT(*) as count
       FROM attendance 
       WHERE student_id = $1 
       GROUP BY status`,
      [studentId]
    );

    console.log('📊 Attendance Summary:');
    summary.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count} records`);
    });

    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed parent attendance:', err);
    process.exit(1);
  }
}

main();
