
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
