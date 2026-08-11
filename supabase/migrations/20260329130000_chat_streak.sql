-- Chat streak state lives on `public.couples`.
-- The UI (`src/components/chat/Usemessagestreak.ts`) expects these fields.

ALTER TABLE public.couples
  ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_longest integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_window_start timestamptz,
  ADD COLUMN IF NOT EXISTS streak_window_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_user1_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_user2_sent boolean NOT NULL DEFAULT false;

-- Trigger: update streak on message INSERT.
-- Rolling 24h window:
-- - A window starts at `streak_window_start` and lasts 24 hours.
-- - When a partner sends, we set their sent-flag for the window.
-- - When BOTH flags become true, we increment the streak and start a fresh window
--   (sent flags reset to false, window_start = now()).
-- - If the window expires before both have sent, the streak resets to 0 and a new window starts.

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

  -- Only track streaks for active, fully-linked couples
  IF c.status IS DISTINCT FROM 'active' OR c.user2_id IS NULL THEN
    RETURN NEW;
  END IF;

  sender_is_user1 := (NEW.sender_id = c.user1_id);
  sender_is_user2 := (NEW.sender_id = c.user2_id);
  IF NOT (sender_is_user1 OR sender_is_user2) THEN
    RETURN NEW;
  END IF;

  -- Initialise window if missing
  IF c.streak_window_start IS NULL THEN
    c.streak_window_start := now_ts;
    c.streak_user1_sent := false;
    c.streak_user2_sent := false;
    c.streak_window_complete := false;
  END IF;

  -- Expiry check
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

  -- Complete window when both have sent
  IF user1_sent AND user2_sent THEN
    new_count := COALESCE(c.streak_count, 0) + 1;
    UPDATE public.couples
      SET
        streak_count = new_count,
        streak_longest = GREATEST(COALESCE(streak_longest, 0), new_count),
        -- start a fresh window immediately
        streak_window_start = now_ts,
        streak_window_complete = false,
        streak_user1_sent = false,
        streak_user2_sent = false,
        updated_at = now()
      WHERE id = c.id;
    RETURN NEW;
  END IF;

  -- Persist flags for the open window
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

-- Refresh PostgREST schema cache after DDL
NOTIFY pgrst, 'reload schema';
