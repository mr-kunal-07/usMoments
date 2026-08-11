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

-- Refresh PostgREST schema cache after DDL
NOTIFY pgrst, 'reload schema';
