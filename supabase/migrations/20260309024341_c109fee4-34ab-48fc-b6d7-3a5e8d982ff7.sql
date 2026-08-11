
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
