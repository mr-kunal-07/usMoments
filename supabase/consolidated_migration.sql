-- Consolidated database migration for this repo (Supabase Postgres)
--
-- Generated from the timestamped files in `supabase/migrations/`.
-- This file is intentionally NOT inside `supabase/migrations/`.

-- Usage:
--   - Supabase Dashboard: SQL Editor -> run this file
--   - psql: `psql \"$DATABASE_URL\" -f supabase/consolidated_migration.sql`

BEGIN;

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260222203827_15afaca3-0f3b-4f3c-8c3e-86c414fd48d5.sql
-- ---------------------------------------------------------------------------


-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create folders table
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all folders"
  ON public.folders FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create folders"
  ON public.folders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Authenticated users can update folders"
  ON public.folders FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete folders"
  ON public.folders FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Create media table
CREATE TABLE public.media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all media"
  ON public.media FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload media"
  ON public.media FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can update media"
  ON public.media FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete media"
  ON public.media FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_media_updated_at
  BEFORE UPDATE ON public.media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for media
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('media', 'media', true, 524288000)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload media files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view media files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

CREATE POLICY "Authenticated users can update media files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete media files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media' AND auth.uid() IS NOT NULL);


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260222210508_e3014677-25f4-46d1-b0fc-3df230b2cba1.sql
-- ---------------------------------------------------------------------------


-- Add starred column to media table
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308081221_8139f58c-2c78-441c-af9e-8451aac6720d.sql
-- ---------------------------------------------------------------------------


-- Add emoji column to folders table
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT NULL;

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308082253_333c5861-fc15-4efb-9092-b5be38cf80a7.sql
-- ---------------------------------------------------------------------------


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


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308083543_624422f8-cfc1-44c7-8e70-33265f449fef.sql
-- ---------------------------------------------------------------------------


-- Milestones table for anniversaries and special dates
CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date date NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'milestone', -- 'anniversary' | 'milestone'
  media_id uuid REFERENCES public.media(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view milestones"
  ON public.milestones FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert milestones"
  ON public.milestones FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own milestones"
  ON public.milestones FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own milestones"
  ON public.milestones FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE TRIGGER update_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notifications table for in-app push notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  type text NOT NULL, -- 'upload' | 'love_note' | 'reaction' | 'milestone'
  media_id uuid REFERENCES public.media(id) ON DELETE CASCADE,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = actor_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.milestones;


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308085002_d09f93a8-e5c1-4cd4-a785-a0cf6c6f2146.sql
-- ---------------------------------------------------------------------------


-- ── Couples table ──────────────────────────────────────────────────
CREATE TABLE public.couples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL,
  user2_id uuid,
  invite_code text UNIQUE NOT NULL DEFAULT upper(substr(md5(random()::text || now()::text), 1, 8)),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own couple"
  ON public.couples FOR SELECT TO authenticated
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "Users can create couple invite"
  ON public.couples FOR INSERT TO authenticated
  WITH CHECK (user1_id = auth.uid());

CREATE POLICY "Users can update their couple"
  ON public.couples FOR UPDATE TO authenticated
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "Users can delete their couple"
  ON public.couples FOR DELETE TO authenticated
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- ── Helper: get partner id ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_partner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN user1_id = _user_id THEN user2_id
    WHEN user2_id = _user_id THEN user1_id
    ELSE NULL
  END
  FROM public.couples
  WHERE (user1_id = _user_id OR user2_id = _user_id)
  AND status = 'active'
  LIMIT 1;
$$;

-- ── Helper: accept invite securely ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_couple_invite(_invite_code text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _couple_id uuid;
  _user1_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT id, user1_id INTO _couple_id, _user1_id
  FROM public.couples
  WHERE invite_code = _invite_code
    AND status = 'pending'
    AND user2_id IS NULL
  LIMIT 1;

  IF _couple_id IS NULL THEN
    RETURN json_build_object('error', 'Invalid or expired invite code');
  END IF;

  IF _user1_id = auth.uid() THEN
    RETURN json_build_object('error', 'You cannot accept your own invite');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.couples
    WHERE (user1_id = auth.uid() OR user2_id = auth.uid())
      AND status = 'active'
  ) THEN
    RETURN json_build_object('error', 'You are already linked with a partner');
  END IF;

  UPDATE public.couples
    SET user2_id = auth.uid(), status = 'active', updated_at = now()
  WHERE id = _couple_id;

  RETURN json_build_object('success', true, 'couple_id', _couple_id);
END;
$$;

-- ── Update media RLS to be couple-aware ───────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view all media" ON public.media;
DROP POLICY IF EXISTS "Authenticated users can delete media" ON public.media;
DROP POLICY IF EXISTS "Authenticated users can update media" ON public.media;

CREATE POLICY "Couple members can view media"
  ON public.media FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR uploaded_by = public.get_partner_id(auth.uid())
  );

CREATE POLICY "Couple members can update media"
  ON public.media FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR uploaded_by = public.get_partner_id(auth.uid())
  );

CREATE POLICY "Couple members can delete media"
  ON public.media FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR uploaded_by = public.get_partner_id(auth.uid())
  );

-- ── Update folders RLS to be couple-aware ────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view all folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can delete folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can update folders" ON public.folders;

CREATE POLICY "Couple members can view folders"
  ON public.folders FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR created_by = public.get_partner_id(auth.uid())
  );

CREATE POLICY "Couple members can update folders"
  ON public.folders FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR created_by = public.get_partner_id(auth.uid())
  );

CREATE POLICY "Couple members can delete folders"
  ON public.folders FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR created_by = public.get_partner_id(auth.uid())
  );

-- ── Enable realtime for couples ──────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.couples;


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308091704_0b6f0bb1-158f-492e-9200-945b974acd52.sql
-- ---------------------------------------------------------------------------


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


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308091938_c53a2579-e0d6-4b90-80e2-95b5c475dac7.sql
-- ---------------------------------------------------------------------------

ALTER TABLE public.media ADD COLUMN IF NOT EXISTS taken_at timestamptz;

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308100240_e68f3c74-8c23-4be8-8b9f-b2c2d7aaa632.sql
-- ---------------------------------------------------------------------------


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


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308102445_426ff593-b0dd-451f-936f-8de5e950d470.sql
-- ---------------------------------------------------------------------------


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


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308104711_384d736b-e778-4292-8417-1a37f21b9f73.sql
-- ---------------------------------------------------------------------------


-- Create subscriptions table to track user plan status
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_subscription_id text,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.subscriptions (user_id, plan, status)
SELECT user_id, 'free', 'active'
FROM public.profiles
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT plan FROM public.subscriptions
     WHERE user_id = _user_id
       AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1),
    'free'
  );
$$;


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308110300_8588da23-a16b-4ebc-9191-568e89d1e22e.sql
-- ---------------------------------------------------------------------------


-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. user_roles table (separate from profiles to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role can manage roles"
  ON public.user_roles FOR ALL
  USING (auth.role() = 'service_role');

-- 3. Security definer function — no recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4. Admin policy: admins can read all subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Admins can update any subscription
CREATE POLICY "Admins can update any subscription"
  ON public.subscriptions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Admins can insert subscriptions for any user
CREATE POLICY "Admins can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Admins can view all couples
CREATE POLICY "Admins can view all couples"
  ON public.couples FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Admins can view aggregate media info
CREATE POLICY "Admins can view all media"
  ON public.media FOR SELECT
  USING (has_role(auth.uid(), 'admin'));


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308135757_62518869-d42b-4bd8-bf81-18e312a6c923.sql
-- ---------------------------------------------------------------------------


-- Update get_user_plan to automatically share partner's active plan
-- If the user has their own active paid plan → use it
-- If not, but their partner has one → inherit it automatically
-- Otherwise → free

CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- 1. User's own active paid plan
    (
      SELECT plan
      FROM public.subscriptions
      WHERE user_id = _user_id
        AND status = 'active'
        AND plan != 'free'
      ORDER BY created_at DESC
      LIMIT 1
    ),
    -- 2. Partner's active paid plan (auto-shared — no extra cost)
    (
      SELECT s.plan
      FROM public.subscriptions s
      JOIN public.couples c ON (
        (c.user1_id = _user_id AND c.user2_id = s.user_id)
        OR
        (c.user2_id = _user_id AND c.user1_id = s.user_id)
      )
      WHERE s.status = 'active'
        AND s.plan != 'free'
        AND c.status = 'active'
      ORDER BY s.created_at DESC
      LIMIT 1
    ),
    -- 3. Fallback to free
    'free'
  );
$$;


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308140029_d4b9a820-752b-4427-9980-af6734bcb91a.sql
-- ---------------------------------------------------------------------------


-- Fix: only use own plan if it's a paid (non-free, non-single) plan.
-- If user's own plan is 'free' or 'single', check partner's plan too.

CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- 1. User's own active PAID plan (not free/single)
    (
      SELECT plan
      FROM public.subscriptions
      WHERE user_id = _user_id
        AND status = 'active'
        AND plan NOT IN ('free', 'single')
      ORDER BY created_at DESC
      LIMIT 1
    ),
    -- 2. Partner's active PAID plan (auto-shared)
    (
      SELECT s.plan
      FROM public.subscriptions s
      JOIN public.couples c ON (
        (c.user1_id = _user_id AND c.user2_id = s.user_id)
        OR
        (c.user2_id = _user_id AND c.user1_id = s.user_id)
      )
      WHERE s.status = 'active'
        AND s.plan NOT IN ('free', 'single')
        AND c.status = 'active'
      ORDER BY s.created_at DESC
      LIMIT 1
    ),
    -- 3. Fallback to free
    'free'
  );
$$;


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308141443_4f9fb212-87c0-4aca-bb0c-7a4b9e067f9e.sql
-- ---------------------------------------------------------------------------


-- Fix get_user_plan to always return the HIGHEST plan between own and partner's
-- Plan hierarchy: soulmate > dating > free/single
CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN 'soulmate' IN (own_plan, partner_plan) THEN 'soulmate'
    WHEN 'dating'   IN (own_plan, partner_plan) THEN 'dating'
    ELSE 'free'
  END
  FROM (
    SELECT
      (
        SELECT plan
        FROM public.subscriptions
        WHERE user_id = _user_id
          AND status = 'active'
          AND plan NOT IN ('free', 'single')
        ORDER BY created_at DESC
        LIMIT 1
      ) AS own_plan,
      (
        SELECT s.plan
        FROM public.subscriptions s
        JOIN public.couples c ON (
          (c.user1_id = _user_id AND c.user2_id = s.user_id)
          OR
          (c.user2_id = _user_id AND c.user1_id = s.user_id)
        )
        WHERE s.status = 'active'
          AND s.plan NOT IN ('free', 'single')
          AND c.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT 1
      ) AS partner_plan
  ) plans;
$function$
;


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308141748_b44b1cb7-154d-4d29-b47d-4e3f77224047.sql
-- ---------------------------------------------------------------------------


-- Create plan audit log table
CREATE TABLE public.plan_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id uuid NOT NULL,
  changed_by_user_id uuid NOT NULL,
  old_plan text,
  new_plan text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  note text
);

ALTER TABLE public.plan_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs (via service role in edge function, plus direct admin check)
CREATE POLICY "Admins can view plan audit log"
  ON public.plan_audit_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only service role can insert (edge function uses service role key)
CREATE POLICY "Service role can manage plan audit log"
  ON public.plan_audit_log
  FOR ALL
  USING (auth.role() = 'service_role');


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308144005_730a40b9-010a-4e0a-8377-65f5d2d115c8.sql
-- ---------------------------------------------------------------------------


create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308164835_9b647d64-f57a-4109-95d8-376cb05e84b2.sql
-- ---------------------------------------------------------------------------


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


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308180754_b43e6f7d-5ff8-44f3-b493-82fde0bbe14e.sql
-- ---------------------------------------------------------------------------


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


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308184144_a5a7ab53-2741-4a7a-833f-bd69f8bfc0a1.sql
-- ---------------------------------------------------------------------------


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


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308191349_2018f867-10bc-4575-9f2d-e474a63f6ce0.sql
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308195047_7cab1ae8-063e-4c4e-8d58-913adc4e9872.sql
-- ---------------------------------------------------------------------------


CREATE TABLE public.travel_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  city TEXT,
  country TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  date_visited DATE,
  description TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.travel_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couple members can view travel locations"
  ON public.travel_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.couples c
      WHERE c.id = travel_locations.couple_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

CREATE POLICY "Couple members can insert travel locations"
  ON public.travel_locations FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM public.couples c
      WHERE c.id = travel_locations.couple_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

CREATE POLICY "Couple members can update travel locations"
  ON public.travel_locations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.couples c
      WHERE c.id = travel_locations.couple_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

CREATE POLICY "Couple members can delete travel locations"
  ON public.travel_locations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.couples c
      WHERE c.id = travel_locations.couple_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

CREATE TRIGGER update_travel_locations_updated_at
  BEFORE UPDATE ON public.travel_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308205925_3c5ad0a5-44db-4b75-8848-d9c962d91a6f.sql
-- ---------------------------------------------------------------------------


-- ============================================================
-- SCALABILITY: Critical indexes for 100K user scale
-- ============================================================

-- Enable pg_trgm extension for fast ILIKE / fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- media table: most common query patterns
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON public.media(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by_deleted_at ON public.media(uploaded_by, deleted_at);
CREATE INDEX IF NOT EXISTS idx_media_folder_id ON public.media(folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_is_starred ON public.media(is_starred, uploaded_by) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_media_taken_at ON public.media(taken_at) WHERE taken_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_deleted_at ON public.media(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_created_at ON public.media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_title_trgm ON public.media USING gin(title gin_trgm_ops);

-- messages table: high-frequency couple-scoped queries
CREATE INDEX IF NOT EXISTS idx_messages_couple_id_created_at ON public.messages(couple_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON public.messages(read_at) WHERE read_at IS NULL;

-- message_reactions: per-message lookups
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);

-- notifications: per-recipient lookups
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(recipient_id, read) WHERE read = false;

-- couples: fast lookup by either user
CREATE INDEX IF NOT EXISTS idx_couples_user1_id ON public.couples(user1_id);
CREATE INDEX IF NOT EXISTS idx_couples_user2_id ON public.couples(user2_id);
CREATE INDEX IF NOT EXISTS idx_couples_invite_code ON public.couples(invite_code) WHERE status = 'pending';

-- subscriptions: per-user lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions(user_id, status);

-- profiles: per-user lookup
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- user_roles: admin check is hot path
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);

-- milestones
CREATE INDEX IF NOT EXISTS idx_milestones_created_by ON public.milestones(created_by);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON public.milestones(date DESC);

-- travel_locations: per-couple
CREATE INDEX IF NOT EXISTS idx_travel_locations_couple_id ON public.travel_locations(couple_id);

-- bucket_list: per-couple
CREATE INDEX IF NOT EXISTS idx_bucket_list_couple_id ON public.bucket_list(couple_id);

-- tags: per-user
CREATE INDEX IF NOT EXISTS idx_tags_created_by ON public.tags(created_by);

-- media_tags
CREATE INDEX IF NOT EXISTS idx_media_tags_media_id ON public.media_tags(media_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag_id ON public.media_tags(tag_id);

-- love_notes: per-media
CREATE INDEX IF NOT EXISTS idx_love_notes_media_id ON public.love_notes(media_id);

-- plan_audit_log
CREATE INDEX IF NOT EXISTS idx_plan_audit_log_target_user ON public.plan_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_plan_audit_log_changed_at ON public.plan_audit_log(changed_at DESC);

-- folders: per-user and parent hierarchy
CREATE INDEX IF NOT EXISTS idx_folders_created_by ON public.folders(created_by);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id) WHERE parent_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260308205951_a43eec7c-f25b-4479-a9df-b7c8d60b7c17.sql
-- ---------------------------------------------------------------------------


-- Move pg_trgm to extensions schema (security best practice)
-- Drop the public version and recreate in pg_catalog-compatible way
-- Note: pg_trgm doesn't expose user-callable objects so this is cosmetic,
-- but we move it to follow Supabase's recommendation
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Re-create the GIN trgm index using the extensions-schema operator class
CREATE INDEX IF NOT EXISTS idx_media_title_trgm ON public.media USING gin(title extensions.gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260309023920_1a621b29-7c92-49db-87de-44600ce22ac4.sql
-- ---------------------------------------------------------------------------


-- 1. Fix milestones RLS — scope to couple partners only
DROP POLICY IF EXISTS "Authenticated users can view milestones" ON public.milestones;
DROP POLICY IF EXISTS "Authenticated users can insert milestones" ON public.milestones;
DROP POLICY IF EXISTS "Users can delete their own milestones" ON public.milestones;
DROP POLICY IF EXISTS "Users can update their own milestones" ON public.milestones;

CREATE POLICY "Couple members can view milestones"
  ON public.milestones FOR SELECT
  USING (created_by = auth.uid() OR created_by = get_partner_id(auth.uid()));

CREATE POLICY "Authenticated users can insert milestones"
  ON public.milestones FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Couple members can update milestones"
  ON public.milestones FOR UPDATE
  USING (created_by = auth.uid() OR created_by = get_partner_id(auth.uid()));

CREATE POLICY "Couple members can delete milestones"
  ON public.milestones FOR DELETE
  USING (created_by = auth.uid() OR created_by = get_partner_id(auth.uid()));

-- 2. Fix love_notes RLS — scope to couple partners only
DROP POLICY IF EXISTS "Authenticated users can view love notes" ON public.love_notes;

CREATE POLICY "Couple members can view love notes"
  ON public.love_notes FOR SELECT
  USING (author_id = auth.uid() OR author_id = get_partner_id(auth.uid()));

-- 3. Fix media_reactions RLS — scope to couple partners only
DROP POLICY IF EXISTS "Authenticated users can view reactions" ON public.media_reactions;

CREATE POLICY "Couple members can view media reactions"
  ON public.media_reactions FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id(auth.uid()));

-- 4. Fix media_tags RLS — scope to couple partners only
DROP POLICY IF EXISTS "Authenticated users can view media tags" ON public.media_tags;

CREATE POLICY "Couple members can view media tags"
  ON public.media_tags FOR SELECT
  USING (created_by = auth.uid() OR created_by = get_partner_id(auth.uid()));

-- 5. Fix tags RLS — scope to couple partners only
DROP POLICY IF EXISTS "Authenticated users can view tags" ON public.tags;

CREATE POLICY "Couple members can view tags"
  ON public.tags FOR SELECT
  USING (created_by = auth.uid() OR created_by = get_partner_id(auth.uid()));

-- 6. Add index on milestones for partner queries
CREATE INDEX IF NOT EXISTS idx_milestones_created_by ON public.milestones(created_by);


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260309024341_c109fee4-34ab-48fc-b6d7-3a5e8d982ff7.sql
-- ---------------------------------------------------------------------------


-- Push subscriptions table (no FK to auth.users per security guidelines)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL,
  endpoint  text NOT NULL,
  p256dh    text NOT NULL,
  auth_key  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can read all (needed by edge function)
CREATE POLICY "Service role can read all push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.role() = 'service_role');


-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260309033724_19a465a3-48de-4007-899b-fae6bb8f8b60.sql
-- ---------------------------------------------------------------------------


-- Add visited flag and folder_id link to travel_locations
ALTER TABLE public.travel_locations
  ADD COLUMN IF NOT EXISTS visited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260329124000_messages_soft_delete.sql
-- ---------------------------------------------------------------------------

-- Messages: soft delete support
-- Frontend filters on `deleted_at=is.null` and sets `deleted_at` on delete.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_messages_couple_id_deleted_at_created_at
  ON public.messages (couple_id, deleted_at, created_at DESC);

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260329130000_chat_streak.sql
-- ---------------------------------------------------------------------------

-- Chat streak state lives on `public.couples`.
-- The UI (`src/components/chat/Usemessagestreak.ts`) expects these fields.

ALTER TABLE public.couples
  ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_longest integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_window_start timestamptz,
  ADD COLUMN IF NOT EXISTS streak_window_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_user1_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_user2_sent boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.update_chat_streak_on_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  now_ts timestamptz;
  sender_is_user1 boolean;
  sender_is_user2 boolean;
  window_expires timestamptz;
  user1_sent boolean;
  user2_sent boolean;
  new_count integer;
BEGIN
  now_ts := COALESCE(NEW.created_at, now());

  SELECT *
  INTO c
  FROM public.couples
  WHERE id = NEW.couple_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF c.status IS DISTINCT FROM 'active' OR c.user2_id IS NULL THEN
    RETURN NEW;
  END IF;

  sender_is_user1 := (NEW.sender_id = c.user1_id);
  sender_is_user2 := (NEW.sender_id = c.user2_id);
  IF NOT (sender_is_user1 OR sender_is_user2) THEN
    RETURN NEW;
  END IF;

  IF c.streak_window_start IS NULL THEN
    c.streak_window_start := now_ts;
    c.streak_user1_sent := false;
    c.streak_user2_sent := false;
    c.streak_window_complete := false;
  END IF;

  window_expires := c.streak_window_start + interval '24 hours';
  IF now_ts > window_expires THEN
    c.streak_count := 0;
    c.streak_window_start := now_ts;
    c.streak_user1_sent := false;
    c.streak_user2_sent := false;
    c.streak_window_complete := false;
  END IF;

  user1_sent := c.streak_user1_sent;
  user2_sent := c.streak_user2_sent;
  IF sender_is_user1 THEN user1_sent := true; END IF;
  IF sender_is_user2 THEN user2_sent := true; END IF;

  IF user1_sent AND user2_sent THEN
    new_count := COALESCE(c.streak_count, 0) + 1;
    UPDATE public.couples
      SET
        streak_count = new_count,
        streak_longest = GREATEST(COALESCE(streak_longest, 0), new_count),
        streak_window_start = now_ts,
        streak_window_complete = false,
        streak_user1_sent = false,
        streak_user2_sent = false,
        updated_at = now()
      WHERE id = c.id;
    RETURN NEW;
  END IF;

  UPDATE public.couples
    SET
      streak_window_start = c.streak_window_start,
      streak_window_complete = false,
      streak_user1_sent = user1_sent,
      streak_user2_sent = user2_sent,
      updated_at = now()
    WHERE id = c.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_chat_streak_on_message_insert ON public.messages;
CREATE TRIGGER trg_update_chat_streak_on_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_streak_on_message_insert();

GRANT EXECUTE ON FUNCTION public.update_chat_streak_on_message_insert() TO service_role;

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260329133000_chat_theme.sql
-- ---------------------------------------------------------------------------

-- Chat theme selection for the couple chat UI.
-- Used by `src/components/chat/Usechattheme.ts`.

ALTER TABLE public.couples
  ADD COLUMN IF NOT EXISTS chat_theme_id text NOT NULL DEFAULT 'default';

-- Refresh PostgREST schema cache after DDL
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260329123000_check_couple_invite_rpc.sql
-- ---------------------------------------------------------------------------

-- Public RPC for validating an invite code without exposing table access.
-- Used by the unauthenticated /auth page to decide whether to show /invite-expired.

CREATE OR REPLACE FUNCTION public.check_couple_invite(_invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user2 uuid;
  _status text;
BEGIN
  IF _invite_code IS NULL OR length(trim(_invite_code)) = 0 THEN
    RETURN json_build_object('ok', false, 'reason', 'missing');
  END IF;

  SELECT user2_id, status INTO _user2, _status
  FROM public.couples
  WHERE invite_code = upper(trim(_invite_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'missing');
  END IF;

  IF _user2 IS NOT NULL OR _status = 'active' THEN
    RETURN json_build_object('ok', false, 'reason', 'committed');
  END IF;

  RETURN json_build_object('ok', true, 'reason', 'valid');
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_couple_invite(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Source: supabase/migrations/20260329120000_grants_postgrest_roles.sql
-- ---------------------------------------------------------------------------

-- Grants for PostgREST API roles (Supabase)
-- Fixes: "permission denied for schema public" and similar permission errors
-- Note: RLS still applies; these are only SQL privileges.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO anon, authenticated, service_role;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO anon, authenticated, service_role;

GRANT EXECUTE
ON ALL FUNCTIONS IN SCHEMA public
TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLES
TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLES
TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT
ON SEQUENCES
TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT
ON SEQUENCES
TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE
ON FUNCTIONS
TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE
ON FUNCTIONS
TO anon;

-- Refresh PostgREST schema cache (delivered on transaction commit)
NOTIFY pgrst, 'reload schema';


COMMIT;

