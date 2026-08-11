
-- 1. Fix milestones RLS — scope to couple partners only
DROP POLICY IF EXISTS "Authenticated users can view milestones" ON public.milestones;
DROP POLICY IF EXISTS "Authenticated users can insert milestones" ON public.milestones;
DROP POLICY IF EXISTS "Users can delete their own milestones" ON public.milestones;
DROP POLICY IF EXISTS "Users can update their own milestones" ON public.milestones;

CREATE POLICY "Couple members can view milestones"
  ON public.milestones FOR SELECT
  USING (created_by = auth.uid() OR created_by = get_partner_id(auth.uid()));

CREATE POLICY "Authenticated users can insert milestones"
  ON public.milestones FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Couple members can update milestones"
  ON public.milestones FOR UPDATE
  USING (created_by = auth.uid() OR created_by = get_partner_id(auth.uid()));

CREATE POLICY "Couple members can delete milestones"
  ON public.milestones FOR DELETE
  USING (created_by = auth.uid() OR created_by = get_partner_id(auth.uid()));

-- 2. Fix love_notes RLS — scope to couple partners only
DROP POLICY IF EXISTS "Authenticated users can view love notes" ON public.love_notes;

CREATE POLICY "Couple members can view love notes"
  ON public.love_notes FOR SELECT
  USING (author_id = auth.uid() OR author_id = get_partner_id(auth.uid()));

-- 3. Fix media_reactions RLS — scope to couple partners only
DROP POLICY IF EXISTS "Authenticated users can view reactions" ON public.media_reactions;

CREATE POLICY "Couple members can view media reactions"
  ON public.media_reactions FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id(auth.uid()));

-- 4. Fix media_tags RLS — scope to couple partners only
DROP POLICY IF EXISTS "Authenticated users can view media tags" ON public.media_tags;

CREATE POLICY "Couple members can view media tags"
  ON public.media_tags FOR SELECT
  USING (created_by = auth.uid() OR created_by = get_partner_id(auth.uid()));

-- 5. Fix tags RLS — scope to couple partners only
DROP POLICY IF EXISTS "Authenticated users can view tags" ON public.tags;

CREATE POLICY "Couple members can view tags"
  ON public.tags FOR SELECT
  USING (created_by = auth.uid() OR created_by = get_partner_id(auth.uid()));

-- 6. Add index on milestones for partner queries
CREATE INDEX IF NOT EXISTS idx_milestones_created_by ON public.milestones(created_by);
