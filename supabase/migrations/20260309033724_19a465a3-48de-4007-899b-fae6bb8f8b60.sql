
-- Add visited flag and folder_id link to travel_locations
ALTER TABLE public.travel_locations
  ADD COLUMN IF NOT EXISTS visited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;
