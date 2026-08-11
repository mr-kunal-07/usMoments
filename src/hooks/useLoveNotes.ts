import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyCouple } from "@/hooks/useCouple";
import { encryptText, decryptText } from "@/lib/crypto";
import { QK } from "@/lib/queryKeys";

export interface LoveNote {
  id: string;
  media_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface MediaReaction {
  id: string;
  media_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

// ── Love Notes ───────────────────────────────────────────────────────

export function useLoveNotes(mediaId: string) {
  const { user } = useAuth();
  const { data: couple } = useMyCouple();
  const coupleId = couple?.status === "active" ? couple.id : null;

  return useQuery({
    queryKey: QK.loveNotes(mediaId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("love_notes")
        .select("*")
        .eq("media_id", mediaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const raw = data as LoveNote[];
      if (!coupleId) return raw;
      return Promise.all(
        raw.map(async (n) => ({ ...n, content: await decryptText(n.content, coupleId) }))
      );
    },
    enabled: !!user && !!mediaId,
  });
}

export function useAddLoveNote() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: couple } = useMyCouple();
  const coupleId = couple?.status === "active" ? couple.id : null;

  return useMutation({
    mutationFn: async ({ mediaId, content }: { mediaId: string; content: string }) => {
      const encryptedContent = coupleId ? await encryptText(content, coupleId) : content;
      const { error } = await supabase.from("love_notes").insert({
        media_id: mediaId,
        author_id: user!.id,
        content: encryptedContent,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: QK.loveNotes(vars.mediaId) }),
  });
}

export function useDeleteLoveNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, mediaId }: { id: string; mediaId: string }) => {
      const { error } = await supabase.from("love_notes").delete().eq("id", id);
      if (error) throw error;
      return mediaId;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: QK.loveNotes(vars.mediaId) }),
  });
}

// ── Reactions ────────────────────────────────────────────────────────

export function useMediaReactions(mediaId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: QK.reactions(mediaId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_reactions")
        .select("*")
        .eq("media_id", mediaId);
      if (error) throw error;
      return data as MediaReaction[];
    },
    enabled: !!user && !!mediaId,
  });
}

export function useToggleReaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ mediaId, emoji }: { mediaId: string; emoji: string }) => {
      const { data: existing } = await supabase
        .from("media_reactions")
        .select("id")
        .eq("media_id", mediaId)
        .eq("user_id", user!.id)
        .eq("emoji", emoji)
        .maybeSingle();

      if (existing) {
        await supabase.from("media_reactions").delete().eq("id", existing.id);
      } else {
        await supabase.from("media_reactions").insert({ media_id: mediaId, user_id: user!.id, emoji });
      }
      return mediaId;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: QK.reactions(vars.mediaId) }),
  });
}
