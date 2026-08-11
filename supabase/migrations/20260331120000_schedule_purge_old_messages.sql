-- Schedule chat message auto-purge so messages older than 24 hours are removed
-- from the database and any stored voice-note files are cleaned up.

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'purge-old-messages-every-15-min'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'purge-old-messages-every-15-min',
  '*/15 * * * *',
  $$
    SELECT
      net.http_post(
        url := 'https://krdwlkdwwawoucigilxw.functions.supabase.co/purge-old-messages',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', coalesce(
            (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1),
            ''
          )
        ),
        body := '{}'::jsonb
      );
  $$
);
