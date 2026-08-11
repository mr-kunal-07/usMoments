import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Media } from "@/hooks/useMedia";
import { QK } from "@/lib/queryKeys";
import { usePrivateScope } from "@/hooks/usePrivateScope";

/** Returns media uploaded on today's date (any year) */
export function useOnThisDay() {
  const { user } = useAuth();
  const { allowedUserIds, scopeKey } = usePrivateScope();
  return useQuery({
    queryKey: [...QK.onThisDay(), scopeKey],
    queryFn: async () => {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");

      // Fetch all media and filter in JavaScript
      const { data, error } = await supabase
        .from("media")
        .select("*")
        .in("uploaded_by", allowedUserIds)
        .is("deleted_at", null)
        .not("created_at", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const currentYear = now.getFullYear();

      // Filter for matching month/day in previous years
      return (data as Media[]).filter(m => {
        const date = new Date(m.created_at);
        return date.getMonth() + 1 === parseInt(month)
          && date.getDate() === parseInt(day)
          && date.getFullYear() < currentYear;
      });
    },
    enabled: !!user && allowedUserIds.length > 0,
  });
}

/** Returns all media grouped by day using taken_at (EXIF) if available, else created_at */
export function useMemoriesTimeline() {
  const { user } = useAuth();
  const { allowedUserIds, scopeKey } = usePrivateScope();
  return useQuery({
    queryKey: [...QK.memoriesTimeline(), scopeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media")
        .select("*")
        .in("uploaded_by", allowedUserIds)
        .is("deleted_at", null)
        .not("created_at", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const groups: Record<string, (Media & { taken_at?: string | null })[]> = {};
      (data as (Media & { taken_at?: string | null })[]).forEach(m => {
        const dateStr = m.taken_at ?? m.created_at;
        const d = new Date(dateStr);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(m);
      });

      Object.values(groups).forEach(arr => {
        arr.sort((a, b) => {
          const da = new Date(a.taken_at ?? a.created_at).getTime();
          const db = new Date(b.taken_at ?? b.taken_at).getTime();
          return da - db;
        });
      });

      return groups;
    },
    enabled: !!user && allowedUserIds.length > 0,
  });
}

/** Returns aggregate relationship stats */
export function useRelationshipStats() {
  const { user } = useAuth();
  const { allowedUserIds, scopeKey } = usePrivateScope();
  return useQuery({
    queryKey: [...QK.relationshipStats(), scopeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media")
        .select("id, file_type, file_size, created_at, is_starred, uploaded_by")
        .in("uploaded_by", allowedUserIds)
        .is("deleted_at", null);

      if (error) throw error;

      const all = data ?? [];
      const total = all.length;
      const images = all.filter(m => m.file_type === "image").length;
      const videos = all.filter(m => m.file_type === "video").length;
      const starred = all.filter(m => m.is_starred).length;
      const totalSize = all.reduce((s, m) => s + (m.file_size ?? 0), 0);
      const firstMedia = all.length
        ? all.reduce((a, b) => new Date(a.created_at) < new Date(b.created_at) ? a : b)
        : null;
      const firstDate = firstMedia ? new Date(firstMedia.created_at) : null;
      const daysTogether = firstDate
        ? Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return { total, images, videos, starred, totalSize, firstDate, daysTogether };
    },
    enabled: !!user && allowedUserIds.length > 0,
  });
}
