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

function pickStatus() {
  const r = Math.random();
  if (r < 0.82) return 'present';
  if (r < 0.90) return 'absent';
  if (r < 0.96) return 'late';
  return 'excused';
}

async function main() {
  try {
    console.log('🌱 Seeding recent attendance...');

    const classes = await db.query(
      `SELECT id, name FROM classes`
    );

    let total = 0;

    for (const klass of classes.rows) {
      const roster = await db.query(
        `SELECT s.id AS student_id
         FROM student_classes sc
         JOIN students s ON sc.student_id = s.id
         WHERE sc.class_id = $1`,
        [klass.id]
      );

      if (roster.rows.length === 0) continue;

      for (const d of lastNDates(14)) {
        const dateStr = formatDate(d);
        for (const row of roster.rows) {
          const status = pickStatus();
          const notes = status === 'excused' ? 'Note: Excused' : null;
          await db.query(
            `INSERT INTO attendance (student_id, class_id, date, status, notes)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (student_id, class_id, date)
             DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes`,
            [row.student_id, klass.id, dateStr, status, notes]
          );
          total += 1;
        }
      }
    }

    console.log(`✅ Seeded/updated ${total} attendance rows for the last 14 days.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed attendance:', err);
    process.exit(1);
  }
}

main();


