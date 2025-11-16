-- HRFlow Pro Database Initialization Script
-- Creates separate schemas for each microservice

-- Create schemas
CREATE SCHEMA IF NOT EXISTS employee;
CREATE SCHEMA IF NOT EXISTS attendance;
CREATE SCHEMA IF NOT EXISTS leave;
CREATE SCHEMA IF NOT EXISTS location;
CREATE SCHEMA IF NOT EXISTS payroll;
CREATE SCHEMA IF NOT EXISTS audit;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA employee TO hrflow_admin;
GRANT ALL PRIVILEGES ON SCHEMA attendance TO hrflow_admin;
GRANT ALL PRIVILEGES ON SCHEMA leave TO hrflow_admin;
GRANT ALL PRIVILEGES ON SCHEMA location TO hrflow_admin;
GRANT ALL PRIVILEGES ON SCHEMA payroll TO hrflow_admin;
GRANT ALL PRIVILEGES ON SCHEMA audit TO hrflow_admin;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Set search path
ALTER DATABASE hrflow_dev SET search_path TO public, employee, attendance, leave, location, payroll, audit;

\echo 'Database initialization completed successfully'
