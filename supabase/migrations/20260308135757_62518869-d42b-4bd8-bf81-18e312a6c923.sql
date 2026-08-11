
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
