-- Allow couple members to delete any message (not just their own)
DROP POLICY IF EXISTS "Senders can delete their messages" ON public.messages;

CREATE POLICY "Couple members can delete messages"
ON public.messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.couples
    WHERE couples.id = messages.couple_id
      AND (couples.user1_id = auth.uid() OR couples.user2_id = auth.uid())
      AND couples.status = 'active'
  )
);