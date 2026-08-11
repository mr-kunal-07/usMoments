-- Ensure one subscription row per user so upserts on user_id work reliably.
-- Keep the newest row for each user, then enforce uniqueness.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY created_at DESC, updated_at DESC, id DESC
    ) AS rn
  FROM public.subscriptions
)
DELETE FROM public.subscriptions s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_user_id
  ON public.subscriptions(user_id);
