
-- Create plan audit log table
CREATE TABLE public.plan_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id uuid NOT NULL,
  changed_by_user_id uuid NOT NULL,
  old_plan text,
  new_plan text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  note text
);

ALTER TABLE public.plan_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs (via service role in edge function, plus direct admin check)
CREATE POLICY "Admins can view plan audit log"
  ON public.plan_audit_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only service role can insert (edge function uses service role key)
CREATE POLICY "Service role can manage plan audit log"
  ON public.plan_audit_log
  FOR ALL
  USING (auth.role() = 'service_role');
