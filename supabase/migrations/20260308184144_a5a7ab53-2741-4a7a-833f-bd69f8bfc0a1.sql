
-- Add new columns to bucket_list
ALTER TABLE public.bucket_list
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS completed_photo_url text,
  ADD COLUMN IF NOT EXISTS note text;

-- Create bucket_list_reactions table
CREATE TABLE IF NOT EXISTS public.bucket_list_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.bucket_list(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL DEFAULT '❤️',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id, emoji)
);

ALTER TABLE public.bucket_list_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couple members can view bucket list reactions"
  ON public.bucket_list_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bucket_list bl
      JOIN public.couples c ON c.id = bl.couple_id
      WHERE bl.id = bucket_list_reactions.item_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

CREATE POLICY "Couple members can insert bucket list reactions"
  ON public.bucket_list_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.bucket_list bl
      JOIN public.couples c ON c.id = bl.couple_id
      WHERE bl.id = bucket_list_reactions.item_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

CREATE POLICY "Users can delete their own bucket list reactions"
  ON public.bucket_list_reactions FOR DELETE
  USING (auth.uid() = user_id);
