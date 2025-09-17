-- Minimal auth bootstrap (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  user_type VARCHAR(20) NOT NULL DEFAULT 'student',
  phone VARCHAR(30),
  date_of_birth DATE,
  gender VARCHAR(20),
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  expires_at TIMESTAMP,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed admin user if missing
DO $$
DECLARE
  admin_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@eduai.com') THEN
    INSERT INTO users (email, password_hash, first_name, last_name, user_type, email_verified, is_active)
    VALUES ('admin@eduai.com', '$2a$12$a3jarJIZ4i5SgCa6qNSJOOasoh4fO3utkvywQB2TfLiLBoBFFUIyS', 'Admin', 'User', 'admin', TRUE, TRUE)
    RETURNING id INTO admin_id;
  END IF;
END $$;
