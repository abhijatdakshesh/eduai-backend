const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Create jobs table if missing
    await pool.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        company VARCHAR(200) NOT NULL,
        location VARCHAR(200),
        job_type VARCHAR(20) NOT NULL,
        salary_min INTEGER,
        salary_max INTEGER,
        description TEXT,
        requirements TEXT,
        posted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deadline DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_by UUID,
        application_url TEXT
      );
    `);

    // Create job_applications table if missing
    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
        student_id UUID,
        application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        resume_url VARCHAR(500),
        cover_letter TEXT,
        UNIQUE(job_id, student_id)
      );
    `);

    // Seed only the two external roles (idempotent by title+company)
    const jobs = [
      {
        title: 'Software Engineer, Product (Bangalore)',
        company: 'Meta',
        location: 'Bangalore, India',
        job_type: 'full-time',
        description: 'Build cutting-edge products at scale with cross-functional teams.',
        requirements: '2+ years; Python/JS/Hack; large-scale apps; CS degree preferred',
        deadline: '2025-12-31',
        application_url: 'https://www.metacareers.com/jobs/498554243316897?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic',
      },
      {
        title: 'Software Engineer II, ITC',
        company: 'Nike',
        location: 'Karnataka, India',
        job_type: 'full-time',
        description: 'Build internal product creation tools; API-first capabilities; SPA frontends.',
        requirements: 'React/Angular/Vue, AWS (Lambda, DynamoDB), CI/CD, testing frameworks',
        deadline: '2025-12-31',
        application_url: 'https://careers.nike.com/software-engineer-ii-itc/job/R-44289?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic',
      },
    ];

    for (const j of jobs) {
      await pool.query('DELETE FROM jobs WHERE title = $1 AND company = $2', [j.title, j.company]);
      await pool.query(
        `INSERT INTO jobs (
          title, company, location, job_type, description, requirements, deadline, is_active, application_url
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8)`,
        [j.title, j.company, j.location, j.job_type, j.description, j.requirements, j.deadline, j.application_url]
      );
    }

    console.log('✅ Jobs tables ensured and two postings seeded.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


