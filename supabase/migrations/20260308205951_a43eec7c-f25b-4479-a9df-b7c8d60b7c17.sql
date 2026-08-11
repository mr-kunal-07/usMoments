
-- Move pg_trgm to extensions schema (security best practice)
-- Drop the public version and recreate in pg_catalog-compatible way
-- Note: pg_trgm doesn't expose user-callable objects so this is cosmetic,
-- but we move it to follow Supabase's recommendation
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Re-create the GIN trgm index using the extensions-schema operator class
CREATE INDEX IF NOT EXISTS idx_media_title_trgm ON public.media USING gin(title extensions.gin_trgm_ops);
