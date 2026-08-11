
-- Add soft-delete column to media table
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for efficient recently-deleted queries
CREATE INDEX IF NOT EXISTS idx_media_deleted_at ON public.media (deleted_at) WHERE deleted_at IS NOT NULL;

-- Update RLS: normal view excludes soft-deleted
DROP POLICY IF EXISTS "Couple members can view media" ON public.media;
CREATE POLICY "Couple members can view media" ON public.media
  FOR SELECT USING (
    deleted_at IS NULL AND (
      uploaded_by = auth.uid() OR uploaded_by = get_partner_id(auth.uid())
    )
  );

-- Policy for viewing recently deleted (within 14 days)
CREATE POLICY "Couple members can view recently deleted" ON public.media
  FOR SELECT USING (
    deleted_at IS NOT NULL AND
    deleted_at > now() - interval '14 days' AND (
      uploaded_by = auth.uid() OR uploaded_by = get_partner_id(auth.uid())
    )
  );

-- Couple members can update media (including restoring deleted)
DROP POLICY IF EXISTS "Couple members can update media" ON public.media;
CREATE POLICY "Couple members can update media" ON public.media
  FOR UPDATE USING (
    uploaded_by = auth.uid() OR uploaded_by = get_partner_id(auth.uid())
  );

-- Admins can view all media (including deleted)
DROP POLICY IF EXISTS "Admins can view all media" ON public.media;
CREATE POLICY "Admins can view all media" ON public.media
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
