
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
