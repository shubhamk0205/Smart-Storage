-- Initialize database schema
-- This script runs automatically when the PostgreSQL container is first created

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a function to check if a table exists
CREATE OR REPLACE FUNCTION table_exists(table_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = table_name
    );
END;
$$ LANGUAGE plpgsql;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Smart Storage database initialized successfully!';
END $$;

