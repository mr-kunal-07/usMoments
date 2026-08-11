
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
