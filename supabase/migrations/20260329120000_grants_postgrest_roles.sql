-- Grants for PostgREST API roles (Supabase)
-- Fixes: "permission denied for schema public" and similar permission errors
-- Note: RLS still applies; these are only SQL privileges.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO anon, authenticated, service_role;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO anon, authenticated, service_role;

GRANT EXECUTE
ON ALL FUNCTIONS IN SCHEMA public
TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLES
TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLES
TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT
ON SEQUENCES
TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT
ON SEQUENCES
TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE
ON FUNCTIONS
TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE
ON FUNCTIONS
TO anon;

-- Refresh PostgREST schema cache (delivered on transaction commit)
NOTIFY pgrst, 'reload schema';
