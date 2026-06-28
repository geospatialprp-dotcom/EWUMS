-- EGIP Database Setup (run as PostgreSQL superuser, e.g. postgres)
-- Step 1: Connect to default "postgres" database in pgAdmin or psql, then run this file.

-- Create application user (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'egip') THEN
    CREATE USER egip WITH PASSWORD 'egip_secret';
  END IF;
END
$$;

-- Create database (run separately if this fails because DB already exists)
CREATE DATABASE egip OWNER egip;
