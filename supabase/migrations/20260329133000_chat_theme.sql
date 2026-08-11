-- Chat theme selection for the couple chat UI.
-- Used by `src/components/chat/Usechattheme.ts`.

ALTER TABLE public.couples
  ADD COLUMN IF NOT EXISTS chat_theme_id text NOT NULL DEFAULT 'default';

-- Refresh PostgREST schema cache after DDL
NOTIFY pgrst, 'reload schema';

