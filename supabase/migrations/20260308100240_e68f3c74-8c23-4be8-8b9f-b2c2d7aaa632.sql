
-- Add reply_to_id to messages for threaded replies
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

-- Message reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  emoji      text NOT NULL DEFAULT '❤️',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couple members can view message reactions"
  ON public.message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.couples c ON c.id = m.couple_id
      WHERE m.id = message_reactions.message_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

CREATE POLICY "Users can insert their own message reactions"
  ON public.message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own message reactions"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for message_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
