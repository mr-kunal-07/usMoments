import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyCouple } from "@/hooks/useCouple";

export interface TravelLocation {
  id: string;
  couple_id: string;
  location_name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  date_visited: string | null;
  description: string | null;
  photo_urls: string[];
  tags: string[];
  visited: boolean;
  folder_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTravelLocation {
  location_name: string;
  city?: string;
  country?: string;
  latitude: number;
  longitude: number;
  date_visited?: string;
  description?: string;
  photo_urls?: string[];
  tags?: string[];
  visited?: boolean;
  folder_id?: string;
}

const QK = {
  travelLocations: (coupleId: string) => ["travel_locations", coupleId],
};

export function useTravelLocations() {
  const { data: couple } = useMyCouple();
  const coupleId = couple?.status === "active" ? couple.id : null;

  return useQuery({
    queryKey: QK.travelLocations(coupleId ?? ""),
    enabled: !!coupleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travel_locations")
        .select("*")
        .eq("couple_id", coupleId!)
        .order("date_visited", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TravelLocation[];
    },
  });
}

export function useAddTravelLocation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: couple } = useMyCouple();

  return useMutation({
    mutationFn: async (payload: CreateTravelLocation) => {
      if (!couple?.id || !user?.id) throw new Error("Not in an active couple");
      const { data, error } = await supabase
        .from("travel_locations")
        .insert({
          ...payload,
          couple_id: couple.id,
          created_by: user.id,
          photo_urls: payload.photo_urls ?? [],
          tags: payload.tags ?? [],
        })
        .select()
        .single();
      if (error) throw error;
      return data as TravelLocation;
    },
    onSuccess: (_, __, _ctx) => {
      if (couple?.id) qc.invalidateQueries({ queryKey: QK.travelLocations(couple.id) });
    },
  });
}

export function useUpdateTravelLocation() {
  const qc = useQueryClient();
  const { data: couple } = useMyCouple();

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CreateTravelLocation> & { id: string }) => {
      const { data, error } = await supabase
        .from("travel_locations")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as TravelLocation;
    },
    onSuccess: () => {
      if (couple?.id) qc.invalidateQueries({ queryKey: QK.travelLocations(couple.id) });
    },
  });
}

export function useDeleteTravelLocation() {
  const qc = useQueryClient();
  const { data: couple } = useMyCouple();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("travel_locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (couple?.id) qc.invalidateQueries({ queryKey: QK.travelLocations(couple.id) });
    },
  });
}
