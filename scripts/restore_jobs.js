const db = require('../config/database');

async function restoreJobs() {
  const jobs = [
    {
      title: 'Software Engineer, Product (Bangalore)',
      company: 'Meta',
      location: 'Bangalore, India',
      job_type: 'full-time',
      salary_min: null,
      salary_max: null,
      description: 'Build cutting-edge products at scale with cross-functional teams.',
      requirements: '2+ years; Python/JS/Hack; large-scale apps; CS degree preferred',
      deadline: '2025-12-31',
      application_url: 'https://www.metacareers.com/jobs/498554243316897?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic'
    },
    {
      title: 'Software Engineer II, ITC',
      company: 'Nike',
      location: 'Karnataka, India',
      job_type: 'full-time',
      salary_min: null,
      salary_max: null,
      description: 'Build internal product creation tools; API-first capabilities; SPA frontends.',
      requirements: 'React/Angular/Vue, AWS (Lambda, DynamoDB), CI/CD, testing frameworks',
      deadline: '2025-12-31',
      application_url: 'https://careers.nike.com/software-engineer-ii-itc/job/R-44289?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic'
    }
  ];

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    for (const j of jobs) {
      // Remove any existing row with the same title + company to avoid duplicates
      await client.query('DELETE FROM jobs WHERE title = $1 AND company = $2', [j.title, j.company]);

      await client.query(
        `INSERT INTO jobs (
          title, company, location, job_type, salary_min, salary_max, description, requirements, deadline, is_active, application_url
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)`,
        [
          j.title,
          j.company,
          j.location,
          j.job_type,
          j.salary_min,
          j.salary_max,
          j.description,
          j.requirements,
          j.deadline,
          j.application_url || null,
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`Restored ${jobs.length} jobs.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to restore jobs:', err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

restoreJobs().then(() => process.exit());


