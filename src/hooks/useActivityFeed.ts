import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { QK } from "@/lib/queryKeys";
import { Tables } from "@/integrations/supabase/types";
import { usePrivateScope } from "@/hooks/usePrivateScope";

export type ActivityType = "upload" | "note" | "reaction" | "milestone";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  created_at: string;
  actor_id: string;
  // upload
  media_id?: string;
  media_title?: string;
  media_file_type?: string;
  media_file_path?: string;
  // note
  note_content?: string;
  // reaction
  emoji?: string;
  // milestone
  milestone_title?: string;
  milestone_type?: string;
}

const MEDIA_FIELDS = "id, title, file_type, file_path";
type MediaActivityRow = Pick<Tables<"media">, "id" | "title" | "file_type" | "file_path" | "created_at" | "uploaded_by">;
type JoinedMedia = Pick<Tables<"media">, "id" | "title" | "file_type" | "file_path"> | null;
type LoveNoteActivityRow = Pick<Tables<"love_notes">, "id" | "content" | "author_id" | "created_at"> & { media: JoinedMedia };
type MediaReactionActivityRow = Pick<Tables<"media_reactions">, "id" | "emoji" | "user_id" | "created_at"> & { media: JoinedMedia };
type MilestoneActivityRow = Pick<Tables<"milestones">, "id" | "title" | "type" | "created_by" | "created_at">;

export function useActivityFeed() {
  const { user } = useAuth();
  const { allowedUserIds, scopeKey } = usePrivateScope();
  return useQuery({
    queryKey: [...QK.activityFeed(), scopeKey],
    queryFn: async () => {
      const [mediaRes, notesRes, reactionsRes, milestonesRes] = await Promise.all([
        supabase
          .from("media")
          .select(`${MEDIA_FIELDS}, uploaded_by, created_at`)
          .in("uploaded_by", allowedUserIds)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("love_notes")
          .select(`id, content, author_id, created_at, media:media_id!inner(${MEDIA_FIELDS}, uploaded_by)`)
          .in("media.uploaded_by", allowedUserIds)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("media_reactions")
          .select(`id, emoji, user_id, created_at, media:media_id!inner(${MEDIA_FIELDS}, uploaded_by)`)
          .in("media.uploaded_by", allowedUserIds)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("milestones")
          .select("id, title, type, created_by, created_at")
          .in("created_by", allowedUserIds)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const items: ActivityItem[] = [];

      ((mediaRes.data as MediaActivityRow[] | null) ?? []).forEach((m) => {
        items.push({
          id: `upload-${m.id}`, type: "upload", created_at: m.created_at, actor_id: m.uploaded_by,
          media_id: m.id, media_title: m.title, media_file_type: m.file_type, media_file_path: m.file_path,
        });
      });

      ((notesRes.data as LoveNoteActivityRow[] | null) ?? []).forEach((n) => {
        items.push({
          id: `note-${n.id}`, type: "note", created_at: n.created_at, actor_id: n.author_id,
          media_id: n.media?.id, media_title: n.media?.title, media_file_type: n.media?.file_type,
          media_file_path: n.media?.file_path, note_content: n.content,
        });
      });

      ((reactionsRes.data as MediaReactionActivityRow[] | null) ?? []).forEach((r) => {
        items.push({
          id: `reaction-${r.id}`, type: "reaction", created_at: r.created_at, actor_id: r.user_id,
          media_id: r.media?.id, media_title: r.media?.title, media_file_type: r.media?.file_type,
          media_file_path: r.media?.file_path, emoji: r.emoji,
        });
      });

      ((milestonesRes.data as MilestoneActivityRow[] | null) ?? []).forEach((m) => {
        items.push({
          id: `milestone-${m.id}`, type: "milestone", created_at: m.created_at, actor_id: m.created_by,
          milestone_title: m.title, milestone_type: m.type,
        });
      });

      return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    enabled: !!user && allowedUserIds.length > 0,
    staleTime: 30_000,
  });
}
