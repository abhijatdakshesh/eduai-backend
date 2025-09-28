const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3] || 'password123';
  if (!email) {
    console.error('Usage: node scripts/reset_remote_password.js <email> [newPassword]');
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env.DB_HOST || 'dpg-d354qle3jp1c73eopqk0-a.oregon-postgres.render.com',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'eduai_auth',
    user: process.env.DB_USER || 'eduai_auth_user',
    password: process.env.DB_PASSWORD || 'GTgRPrfaum5TFc36OaiQeMl8aHy8vq4w',
    ssl: { rejectUnauthorized: false },
  });

  try {
    const hash = bcrypt.hashSync(newPassword, 12);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1, is_active = TRUE WHERE email = $2 RETURNING id, email',
      [hash, email]
    );
    console.log('Rows updated:', result.rowCount, result.rows);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


