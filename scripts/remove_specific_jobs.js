const db = require('../config/database');

async function removeJobs() {
  const targets = [
    { title: 'Software Engineer Intern', company: 'TechCorp' },
    { title: 'Marketing Assistant', company: 'GrowthCo' },
    { title: 'Data Analyst', company: 'DataTech' },
    { title: 'Research Assistant', company: 'UniResearch' },
    { title: 'Frontend Developer', company: 'WebSolutions' },
  ];

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Find job IDs matching targets
    const params = [];
    const whereParts = targets.map((t, idx) => {
      const i = idx * 2;
      params.push(t.title, t.company);
      return `(title = $${i + 1} AND company = $${i + 2})`;
    });

    const jobsRes = await client.query(
      `SELECT id, title, company FROM jobs WHERE ${whereParts.join(' OR ')}`,
      params
    );

    if (jobsRes.rows.length === 0) {
      console.log('No matching jobs found. Nothing to delete.');
      await client.query('ROLLBACK');
      return;
    }

    const jobIds = jobsRes.rows.map(r => r.id);

    // Delete related applications first
    await client.query('DELETE FROM job_applications WHERE job_id = ANY($1::uuid[])', [jobIds]);

    // Delete the jobs
    await client.query('DELETE FROM jobs WHERE id = ANY($1::uuid[])', [jobIds]);

    await client.query('COMMIT');
    console.log('Deleted jobs:', jobsRes.rows.map(r => `${r.title} @ ${r.company}`).join(', '));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to remove specific jobs:', err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

removeJobs().then(() => process.exit());


