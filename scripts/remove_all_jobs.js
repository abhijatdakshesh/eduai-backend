const db = require('../config/database');

async function removeAllJobs() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM job_applications');
    await client.query('DELETE FROM jobs');
    await client.query('COMMIT');
    console.log('All jobs and applications removed.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to remove all jobs:', err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

removeAllJobs().then(() => process.exit());


