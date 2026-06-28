-- EGIP Database Setup (run while connected to the "egip" database)
-- Step 2: In pgAdmin, connect to database "egip", open Query Tool, run this file.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Grant schema access
GRANT ALL ON SCHEMA public TO egip;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO egip;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO egip;
