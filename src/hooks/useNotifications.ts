import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { QK } from "@/lib/queryKeys";

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: "upload" | "love_note" | "reaction" | "milestone";
  media_id: string | null;
  message: string;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QK.notifications(),
    staleTime: 30_000, // 30s stale — realtime handles live updates
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
  });

  // Realtime subscription — filtered server-side to recipient
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`) // unique channel per user
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: QK.notifications() })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  return query;
}

export function useUnreadCount() {
  const { data = [] } = useNotifications();
  return data.filter(n => !n.read).length;
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("recipient_id", user!.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.notifications() }),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.notifications() }),
  });
}

/** Send a notification to all OTHER authenticated users */
export async function sendNotification({
  actorId,
  allUserIds,
  type,
  mediaId,
  message,
}: {
  actorId: string;
  allUserIds: string[];
  type: Notification["type"];
  mediaId?: string | null;
  message: string;
}) {
  const recipients = allUserIds.filter(id => id !== actorId);
  if (recipients.length === 0) return;
  await supabase.from("notifications").insert(
    recipients.map(recipient_id => ({
      recipient_id,
      actor_id: actorId,
      type,
      media_id: mediaId ?? null,
      message,
    }))
  );
}
