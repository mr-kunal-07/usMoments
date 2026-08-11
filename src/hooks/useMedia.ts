import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tables } from "@/integrations/supabase/types";
import { QK, invalidateMedia } from "@/lib/queryKeys";
import { pushToPartner } from "@/hooks/usePushNotifications";
import { dashboardPath } from "@/app/router/paths";
import { usePrivateScope } from "@/hooks/usePrivateScope";

export type Media = Tables<"media"> & { uploader_name?: string | null; taken_at?: string | null; deleted_at?: string | null };
type UploadMediaInput = {
  file: File;
  title: string;
  description?: string;
  folderId?: string | null;
  userId: string;
};

/** Page size for paginated media queries */
const PAGE_SIZE = 50;

export function useMedia(folderId?: string | null, search?: string) {
  const { user } = useAuth();
  const { allowedUserIds, scopeKey } = usePrivateScope();
  return useQuery({
    queryKey: [...QK.media(folderId, search), scopeKey],
    staleTime: 30_000, // media lists: 30s stale
    queryFn: async () => {
      let query = supabase.from("media").select("*").in("uploaded_by", allowedUserIds).is("deleted_at", null);
      if (folderId !== undefined) {
        if (folderId) query = query.eq("folder_id", folderId);
        else query = query.is("folder_id", null);
      }
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(500); // hard cap — prevents runaway queries
      if (error) throw error;
      return data as Media[];
    },
    enabled: !!user && allowedUserIds.length > 0,
  });
}

/** Infinite-scroll version of media — use for large vaults */
export function useMediaInfinite(folderId?: string | null, search?: string) {
  const { user } = useAuth();
  const { allowedUserIds, scopeKey } = usePrivateScope();
  return useInfiniteQuery({
    queryKey: [...QK.mediaInfinite(), folderId, search, scopeKey],
    staleTime: 30_000,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase.from("media").select("*").in("uploaded_by", allowedUserIds).is("deleted_at", null);
      if (folderId !== undefined) {
        if (folderId) query = query.eq("folder_id", folderId);
        else query = query.is("folder_id", null);
      }
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data as Media[], nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined };
    },
    getNextPageParam: (last) => last.nextPage,
    enabled: !!user && allowedUserIds.length > 0,
  });
}

export function useRecentlyDeletedMedia() {
  const { user } = useAuth();
  const { allowedUserIds, scopeKey } = usePrivateScope();
  return useQuery({
    queryKey: [...QK.mediaDeleted(), scopeKey],
    staleTime: 60_000,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("media")
        .select("*")
        .in("uploaded_by", allowedUserIds)
        .not("deleted_at", "is", null)
        .gt("deleted_at", cutoff)
        .order("deleted_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Media[];
    },
    enabled: !!user && allowedUserIds.length > 0,
  });
}

export function useStarredMedia() {
  const { user } = useAuth();
  const { allowedUserIds, scopeKey } = usePrivateScope();
  return useQuery({
    queryKey: [...QK.mediaStarred(), scopeKey],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media")
        .select("*")
        .in("uploaded_by", allowedUserIds)
        .eq("is_starred", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Media[];
    },
    enabled: !!user && allowedUserIds.length > 0,
  });
}

async function extractTakenAt(file: File): Promise<string | null> {
  try {
    if (!file.type.startsWith("image/")) return null;
    const exifr = (await import("exifr")).default;
    const result = await exifr.parse(file, ["DateTimeOriginal", "CreateDate", "DateTime"]);
    const raw = result?.DateTimeOriginal ?? result?.CreateDate ?? result?.DateTime;
    if (!raw) return null;
    if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString();
    return null;
  } catch {
    return null;
  }
}

export async function uploadMediaFile({
  file,
  title,
  description,
  folderId,
  userId,
}: UploadMediaInput): Promise<Media> {
  const ext = file.name.split(".").pop();
  const filePath = `${userId}/${crypto.randomUUID()}.${ext}`;
  const takenAt = await extractTakenAt(file);

  const { error: uploadError } = await supabase.storage.from("media").upload(filePath, file);
  if (uploadError) throw uploadError;

  const fileType = file.type.startsWith("video/") ? "video" : "image";

  const { data, error: dbError } = await supabase.from("media").insert({
    title,
    description: description || null,
    file_name: file.name,
    file_path: filePath,
    file_size: file.size,
    file_type: fileType,
    mime_type: file.type,
    folder_id: folderId ?? null,
    uploaded_by: userId,
    ...(takenAt ? { taken_at: takenAt } : {}),
  } as never).select().single();

  if (dbError) {
    await supabase.storage.from("media").remove([filePath]);
    throw dbError;
  }

  void pushToPartner("New Memory Added", `${title} was just uploaded to usMoment`, dashboardPath());
  return data as Media;
}

export function useUploadMedia() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ file, title, description, folderId }: { file: File; title: string; description?: string; folderId?: string | null }) => {
      return uploadMediaFile({
        file,
        title,
        description,
        folderId,
        userId: user!.id,
      });
    },
    onSuccess: () => invalidateMedia(qc),
  });
}

export function useUpdateMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, description }: { id: string; title: string; description?: string }) => {
      const { error } = await supabase.from("media").update({ title, description: description || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateMedia(qc),
  });
}

export function useBackfillExifDates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; file_path: string }[]) => {
      const exifr = (await import("exifr")).default;
      const results: { id: string; taken_at: string }[] = [];

      // Process in batches of 10 to avoid overwhelming the network
      for (let i = 0; i < items.length; i += 10) {
        const batch = items.slice(i, i + 10);
        await Promise.all(
          batch.map(async (item) => {
            try {
              const { data: urlData } = supabase.storage.from("media").getPublicUrl(item.file_path);
              const parsed = await exifr.parse(urlData.publicUrl, ["DateTimeOriginal", "CreateDate", "DateTime"]);
              const raw = parsed?.DateTimeOriginal ?? parsed?.CreateDate ?? parsed?.DateTime;
              if (raw instanceof Date && !isNaN(raw.getTime())) {
                results.push({ id: item.id, taken_at: raw.toISOString() });
              }
            } catch {
              // skip files without EXIF
            }
          })
        );
      }

      // Write in batches of 5
      for (let i = 0; i < results.length; i += 5) {
        const batch = results.slice(i, i + 5);
        await Promise.all(
          batch.map(r => supabase.from("media").update({ taken_at: r.taken_at } as never).eq("id", r.id))
        );
      }
      return results.length;
    },
    onSuccess: (count) => {
      if (count > 0) {
        qc.invalidateQueries({ queryKey: QK.memoriesTimeline() });
        invalidateMedia(qc);
      }
    },
  });
}

/** Soft-delete: sets deleted_at instead of permanently removing */
export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; filePath: string }) => {
      const { error } = await supabase
        .from("media")
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateMedia(qc),
  });
}

/** Restore a soft-deleted media item */
export function useRestoreMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("media")
        .update({ deleted_at: null } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateMedia(qc),
  });
}

/** Permanently delete (used by purge cron and manual permanent delete from trash) */
export function usePermanentDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string }) => {
      await supabase.storage.from("media").remove([filePath]);
      const { error } = await supabase.from("media").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateMedia(qc),
  });
}

export function useMoveMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, folderId }: { id: string; folderId: string | null }) => {
      const { error } = await supabase.from("media").update({ folder_id: folderId }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateMedia(qc),
  });
}

export function useBulkDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; filePath: string }[]) => {
      const ids = items.map(i => i.id);
      const { error } = await supabase
        .from("media")
        .update({ deleted_at: new Date().toISOString() } as never)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => invalidateMedia(qc),
  });
}

export function useBulkMoveMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, folderId }: { ids: string[]; folderId: string | null }) => {
      const { error } = await supabase.from("media").update({ folder_id: folderId }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => invalidateMedia(qc),
  });
}

export function useToggleStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, starred }: { id: string; starred: boolean }) => {
      const { error } = await supabase.from("media").update({ is_starred: starred }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateMedia(qc),
  });
}

export function getPublicUrl(filePath: string) {
  const { data } = supabase.storage.from("media").getPublicUrl(filePath);
  return data.publicUrl;
}

// Re-export QK.memoriesTimeline for backfill hook
const { memoriesTimeline } = QK;
export { memoriesTimeline };
