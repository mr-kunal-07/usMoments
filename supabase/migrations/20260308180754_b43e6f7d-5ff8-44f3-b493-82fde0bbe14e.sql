
-- Create bucket list table for couples
CREATE TABLE public.bucket_list (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  added_by uuid NOT NULL,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bucket_list ENABLE ROW LEVEL SECURITY;

-- Only couple members can view their bucket list
CREATE POLICY "Couple members can view bucket list"
  ON public.bucket_list FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.couples c
      WHERE c.id = bucket_list.couple_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

-- Couple members can insert bucket list items
CREATE POLICY "Couple members can insert bucket list"
  ON public.bucket_list FOR INSERT
  WITH CHECK (
    auth.uid() = added_by AND
    EXISTS (
      SELECT 1 FROM public.couples c
      WHERE c.id = bucket_list.couple_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

-- Couple members can update (toggle done) bucket list items
CREATE POLICY "Couple members can update bucket list"
  ON public.bucket_list FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.couples c
      WHERE c.id = bucket_list.couple_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

-- Only couple members can delete bucket list items
CREATE POLICY "Couple members can delete bucket list"
  ON public.bucket_list FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.couples c
      WHERE c.id = bucket_list.couple_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bucket_list;
