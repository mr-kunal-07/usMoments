import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { QK } from "@/lib/queryKeys";
import { TablesInsert } from "@/integrations/supabase/types";
import { usePrivateScope } from "@/hooks/usePrivateScope";

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_by: string;
  created_at: string;
}

export interface MediaTag {
  id: string;
  media_id: string;
  tag_id: string;
  created_by: string;
  created_at: string;
  tag?: Tag;
}

export const TAG_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#6366f1", "#a855f7", "#ec4899",
  "#14b8a6", "#84cc16",
];

export function useTags() {
  const { user } = useAuth();
  const { allowedUserIds, scopeKey } = usePrivateScope();
  return useQuery({
    queryKey: [...QK.tags(), scopeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags" as never)
        .select("*")
        .in("created_by", allowedUserIds)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Tag[];
    },
    enabled: !!user && allowedUserIds.length > 0,
  });
}

export function useMediaTags(mediaId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: QK.mediaTags(mediaId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_tags" as never)
        .select("*, tag:tag_id(*)")
        .eq("media_id", mediaId);
      if (error) throw error;
      return data as MediaTag[];
    },
    enabled: !!user && !!mediaId,
  });
}

export function useAllMediaTags() {
  const { user } = useAuth();
  return useQuery({
    queryKey: QK.mediaTagsAll(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_tags" as never)
        .select("*, tag:tag_id(*)");
      if (error) throw error;
      return data as MediaTag[];
    },
    enabled: !!user,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const payload: TablesInsert<"tags"> = { name: name.trim(), color, created_by: user!.id };
      const { data, error } = await supabase
        .from("tags")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Tag;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.tags() }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tags" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.tags() });
      qc.invalidateQueries({ queryKey: QK.mediaTags() });
      qc.invalidateQueries({ queryKey: QK.mediaTagsAll() });
    },
  });
}

export function useAddTagToMedia() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ mediaId, tagId }: { mediaId: string; tagId: string }) => {
      const payload: TablesInsert<"media_tags"> = { media_id: mediaId, tag_id: tagId, created_by: user!.id };
      const { error } = await supabase
        .from("media_tags")
        .insert(payload);
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK.mediaTags(vars.mediaId) });
      qc.invalidateQueries({ queryKey: QK.mediaTagsAll() });
    },
  });
}

export function useRemoveTagFromMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mediaId, tagId }: { mediaId: string; tagId: string }) => {
      const { error } = await supabase
        .from("media_tags" as never)
        .delete()
        .eq("media_id", mediaId)
        .eq("tag_id", tagId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK.mediaTags(vars.mediaId) });
      qc.invalidateQueries({ queryKey: QK.mediaTagsAll() });
    },
  });
}
