
-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. user_roles table (separate from profiles to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role can manage roles"
  ON public.user_roles FOR ALL
  USING (auth.role() = 'service_role');

-- 3. Security definer function — no recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4. Admin policy: admins can read all subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Admins can update any subscription
CREATE POLICY "Admins can update any subscription"
  ON public.subscriptions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Admins can insert subscriptions for any user
CREATE POLICY "Admins can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Admins can view all couples
CREATE POLICY "Admins can view all couples"
  ON public.couples FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Admins can view aggregate media info
CREATE POLICY "Admins can view all media"
  ON public.media FOR SELECT
  USING (has_role(auth.uid(), 'admin'));
