-- Messages: soft delete support
-- Frontend filters on `deleted_at=is.null` and sets `deleted_at` on delete.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_messages_couple_id_deleted_at_created_at
  ON public.messages (couple_id, deleted_at, created_at DESC);

-- Refresh PostgREST schema cache after DDL
NOTIFY pgrst, 'reload schema';
