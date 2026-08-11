
-- Add starred column to media table
ALTER TABLE public.media ADD COLUMN is_starred boolean NOT NULL DEFAULT false;
