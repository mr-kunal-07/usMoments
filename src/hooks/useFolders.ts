import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tables } from "@/integrations/supabase/types";
import { QK } from "@/lib/queryKeys";
import { usePrivateScope } from "@/hooks/usePrivateScope";

export type Folder = Tables<"folders">;

export function useFolders() {
  const { user } = useAuth();
  const { allowedUserIds, scopeKey } = usePrivateScope();
  return useQuery({
    queryKey: [...QK.folders(), scopeKey],
    queryFn: async () => {
      const { data, error } = await supabase.from("folders").select("*").in("created_by", allowedUserIds).order("name");
      if (error) throw error;
      return data as Folder[];
    },
    enabled: !!user && allowedUserIds.length > 0,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ name, parentId }: { name: string; parentId?: string | null }) => {
      const { data, error } = await supabase
        .from("folders")
        .insert({ name, parent_id: parentId ?? null, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.folders() }),
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("folders").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.folders() }),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recursively collects all folder IDs in a subtree (the root folder +
 * every descendant), querying the DB so it works even if the local
 * React Query cache is stale.
 */
async function collectSubtreeIds(rootId: string): Promise<string[]> {
  const ids: string[] = [rootId];
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const { data, error } = await supabase
      .from("folders")
      .select("id")
      .eq("parent_id", parentId);

    if (error) throw error;
    if (data?.length) {
      const childIds = data.map((r) => r.id);
      ids.push(...childIds);
      queue.push(...childIds);
    }
  }

  return ids;
}

/**
 * Fetches all file_path values for media that lives in any of the
 * given folder IDs.
 */
async function collectFilePaths(folderIds: string[]): Promise<string[]> {
  if (!folderIds.length) return [];

  const { data, error } = await supabase
    .from("media")
    .select("file_path")
    .in("folder_id", folderIds);

  if (error) throw error;
  return (data ?? []).map((r) => r.file_path).filter(Boolean);
}

/**
 * Deletes files from Supabase Storage in batches of 100.
 * Adjust the bucket name if yours differs.
 */
async function deleteStorageFiles(filePaths: string[], bucket = "media"): Promise<void> {
  const BATCH = 100;
  for (let i = 0; i < filePaths.length; i += BATCH) {
    const batch = filePaths.slice(i, i + BATCH);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    // Log but don't throw — a missing file shouldn't block the folder delete
    if (error) console.warn("[deleteStorageFiles] Storage removal error:", error);
  }
}

// ─── useDeleteFolder ──────────────────────────────────────────────────────────

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Collect this folder + all descendant folder IDs
      const subtreeIds = await collectSubtreeIds(id);

      // 2. Collect every file_path stored in those folders
      const filePaths = await collectFilePaths(subtreeIds);

      // 3. Delete the actual files from Storage
      if (filePaths.length > 0) {
        await deleteStorageFiles(filePaths);
      }
      const { error } = await supabase.from("folders").delete().eq("id", id);
      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.folders() });
      qc.invalidateQueries({ queryKey: QK.mediaAll() });
    },
  });
}
