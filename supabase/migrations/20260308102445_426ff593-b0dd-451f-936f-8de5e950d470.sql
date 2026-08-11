
-- ── Voice messages ──────────────────────────────────────────
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS audio_url text;

-- ── Tags system ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.media_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(media_id, tag_id)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tags"
  ON public.tags FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create tags"
  ON public.tags FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their own tags"
  ON public.tags FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete their own tags"
  ON public.tags FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Authenticated users can view media tags"
  ON public.media_tags FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create media tags"
  ON public.media_tags FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can delete their own media tags"
  ON public.media_tags FOR DELETE USING (auth.uid() = created_by);

-- ── Audio storage bucket ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('audio', 'audio', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload audio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio' AND auth.uid() IS NOT NULL);
CREATE POLICY "Audio is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio');
CREATE POLICY "Users can delete own audio"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);
