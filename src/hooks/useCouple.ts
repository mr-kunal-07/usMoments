import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { QK } from "@/lib/queryKeys";

export interface Couple {
  id: string;
  user1_id: string;
  user2_id: string | null;
  invite_code: string;
  status: "pending" | "active";
  created_at: string;
  updated_at: string;
}

export function useMyCouple() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QK.myCouple(),
    staleTime: 5 * 60_000, // couple data changes rarely
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("couples")
        .select("*")
        .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Couple | null;
    },
    enabled: !!user,
  });

  // Realtime — refresh when couple row changes (partner accepts invite)
  // Subscribe to BOTH user1_id and user2_id so both partners get updates
  useEffect(() => {
    if (!user) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: QK.myCouple() });
      qc.invalidateQueries({ queryKey: QK.mediaAll() });
      qc.invalidateQueries({ queryKey: QK.folders() });
      qc.invalidateQueries({ queryKey: QK.memoriesTimeline() });
      qc.invalidateQueries({ queryKey: QK.onThisDay() });
      qc.invalidateQueries({ queryKey: QK.relationshipStats() });
      qc.invalidateQueries({ queryKey: QK.activityFeed() });
      qc.invalidateQueries({ queryKey: QK.milestones() });
      qc.invalidateQueries({ queryKey: QK.tags() });
    };
    // Channel 1: when this user is user1 (invite creator)
    const ch1 = supabase
      .channel(`couple:user1:${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "couples",
        filter: `user1_id=eq.${user.id}`,
      }, invalidate)
      .subscribe();
    // Channel 2: when this user is user2 (invite acceptor)
    const ch2 = supabase
      .channel(`couple:user2:${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "couples",
        filter: `user2_id=eq.${user.id}`,
      }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [user, qc]);

  return query;
}

/** Create a pending invite (user1 generates invite code) */
export function useCreateInvite() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      // If a couple already exists, reuse the pending invite instead of erroring.
      const { data: existing, error: existingError } = await supabase
        .from("couples")
        .select("*")
        .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        const couple = existing as Couple;
        if (couple.status === "pending" && couple.user1_id === user.id) return couple;
        throw new Error("You already have a couple link");
      }

      const { data, error } = await supabase
        .from("couples")
        .insert({ user1_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as Couple;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.myCouple() }),
  });
}

/** Accept partner's invite code */
export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("accept_couple_invite", {
        _invite_code: code.trim().toUpperCase(),
      });
      if (error) throw error;
      const result = data as { error?: string; success?: boolean };
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.myCouple() });
      qc.invalidateQueries({ queryKey: QK.mediaAll() });
      qc.invalidateQueries({ queryKey: QK.folders() });
      qc.invalidateQueries({ queryKey: QK.memoriesTimeline() });
      qc.invalidateQueries({ queryKey: QK.onThisDay() });
      qc.invalidateQueries({ queryKey: QK.relationshipStats() });
      qc.invalidateQueries({ queryKey: QK.activityFeed() });
      qc.invalidateQueries({ queryKey: QK.milestones() });
      qc.invalidateQueries({ queryKey: QK.tags() });
    },
  });
}

/** Unlink partner (delete the couple record) */
export function useUnlinkPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (coupleId: string) => {
      const { error } = await supabase.from("couples").delete().eq("id", coupleId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.myCouple() });
      qc.invalidateQueries({ queryKey: QK.mediaAll() });
      qc.invalidateQueries({ queryKey: QK.folders() });
      qc.invalidateQueries({ queryKey: QK.memoriesTimeline() });
      qc.invalidateQueries({ queryKey: QK.onThisDay() });
      qc.invalidateQueries({ queryKey: QK.relationshipStats() });
      qc.invalidateQueries({ queryKey: QK.activityFeed() });
      qc.invalidateQueries({ queryKey: QK.milestones() });
      qc.invalidateQueries({ queryKey: QK.tags() });
    },
  });
}
