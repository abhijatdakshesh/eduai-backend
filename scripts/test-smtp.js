const nodemailer = require('nodemailer');
require('dotenv').config();

async function main() {
  const port = Number(process.env.EMAIL_PORT) || 587;
  const secureFromEnv = (process.env.EMAIL_SECURE || '').toLowerCase() === 'true';
  const secure = secureFromEnv || port === 465;
  const requireTLS = (process.env.EMAIL_REQUIRE_TLS || '').toLowerCase() === 'true';
  const rejectUnauthorized = (process.env.EMAIL_TLS_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true';

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    requireTLS,
    tls: {
      rejectUnauthorized,
    },
  });

  try {
    await transporter.verify();
    console.log('SMTP connection verified successfully.');
  } catch (err) {
    console.error('SMTP verification failed:', err.message);
    process.exit(1);
  }

  try {
    const to = process.env.SMTP_TEST_TO || process.env.EMAIL_USER;
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM_RESET || process.env.EMAIL_FROM,
      to,
      subject: 'SMTP Test from EduAI',
      text: 'This is a test email to verify SMTP configuration.',
    });
    console.log('Test email sent. messageId=', info.messageId);
  } catch (err) {
    console.error('Test email send failed:', err.message);
    process.exit(2);
  }
}

main();


