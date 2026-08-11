
-- Create messages table for partner chat
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Only couple members can view messages
CREATE POLICY "Couple members can view messages"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.couples
    WHERE id = messages.couple_id
    AND (user1_id = auth.uid() OR user2_id = auth.uid())
    AND status = 'active'
  )
);

-- Only authenticated couple members can send messages
CREATE POLICY "Couple members can send messages"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.couples
    WHERE id = messages.couple_id
    AND (user1_id = auth.uid() OR user2_id = auth.uid())
    AND status = 'active'
  )
);

-- Only sender can delete their own messages
CREATE POLICY "Senders can delete their messages"
ON public.messages FOR DELETE
USING (auth.uid() = sender_id);

-- Couple members can mark messages as read
CREATE POLICY "Couple members can update messages"
ON public.messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.couples
    WHERE id = messages.couple_id
    AND (user1_id = auth.uid() OR user2_id = auth.uid())
    AND status = 'active'
  )
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
