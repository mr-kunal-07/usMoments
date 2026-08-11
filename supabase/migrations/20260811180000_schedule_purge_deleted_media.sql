-- Requires the same high-entropy value in Vault (`cron_secret`) and the
-- purge-deleted-media Edge Function secret (`CRON_SECRET`).

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'purge-deleted-media-daily'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'purge-deleted-media-daily',
  '0 3 * * *',
  $$
    SELECT
      net.http_post(
        url := 'https://krdwlkdwwawoucigilxw.functions.supabase.co/purge-deleted-media',
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
