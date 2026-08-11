
-- ── Love Notes ───────────────────────────────────────────────────────
CREATE TABLE public.love_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.love_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view love notes"
  ON public.love_notes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own love notes"
  ON public.love_notes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = author_id);

CREATE POLICY "Users can update their own love notes"
  ON public.love_notes FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own love notes"
  ON public.love_notes FOR DELETE
  USING (auth.uid() = author_id);

CREATE TRIGGER update_love_notes_updated_at
  BEFORE UPDATE ON public.love_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Media Reactions ──────────────────────────────────────────────────
CREATE TABLE public.media_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL DEFAULT '❤️',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(media_id, user_id, emoji)
);

ALTER TABLE public.media_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reactions"
  ON public.media_reactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own reactions"
  ON public.media_reactions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions"
  ON public.media_reactions FOR DELETE
  USING (auth.uid() = user_id);
