
CREATE TABLE public.travel_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  city TEXT,
  country TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  date_visited DATE,
  description TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.travel_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couple members can view travel locations"
  ON public.travel_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.couples c
      WHERE c.id = travel_locations.couple_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

CREATE POLICY "Couple members can insert travel locations"
  ON public.travel_locations FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM public.couples c
      WHERE c.id = travel_locations.couple_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

CREATE POLICY "Couple members can update travel locations"
  ON public.travel_locations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.couples c
      WHERE c.id = travel_locations.couple_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

CREATE POLICY "Couple members can delete travel locations"
  ON public.travel_locations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.couples c
      WHERE c.id = travel_locations.couple_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND c.status = 'active'
    )
  );

CREATE TRIGGER update_travel_locations_updated_at
  BEFORE UPDATE ON public.travel_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
