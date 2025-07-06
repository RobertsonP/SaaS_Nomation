-- Initialize Nomation Database
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- The database 'nomation' is already created by POSTGRES_DB environment variable
-- The user 'nomation_user' is already created by POSTGRES_USER environment variable

-- Grant all privileges to the nomation_user
GRANT ALL PRIVILEGES ON DATABASE nomation TO nomation_user;

-- Switch to nomation database context
\c nomation;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO nomation_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nomation_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nomation_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO nomation_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO nomation_user;