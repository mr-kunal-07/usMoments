import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { QK } from "@/lib/queryKeys";
import { pushToPartner } from "@/hooks/usePushNotifications";
import { usePrivateScope } from "@/hooks/usePrivateScope";

export interface Milestone {
  id: string;
  title: string;
  date: string;
  description: string | null;
  type: "anniversary" | "milestone";
  media_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useMilestones() {
  const { user } = useAuth();
  const { allowedUserIds, scopeKey } = usePrivateScope();
  return useQuery({
    queryKey: [...QK.milestones(), scopeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestones")
        .select("*")
        .in("created_by", allowedUserIds)
        .order("date", { ascending: true });
      if (error) throw error;
      return data as Milestone[];
    },
    enabled: !!user && allowedUserIds.length > 0,
  });
}

export function useAddMilestone() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (values: { title: string; date: string; description?: string; type: "anniversary" | "milestone"; media_id?: string | null }) => {
      const { error } = await supabase.from("milestones").insert({ ...values, created_by: user!.id });
      if (error) throw error;
      // Push to partner — non-blocking
      const emoji = values.type === "anniversary" ? "🎉" : "✨";
      pushToPartner(`${emoji} New ${values.type === "anniversary" ? "Anniversary" : "Milestone"}`, `"${values.title}" was added to usMoment`, "/dashboard/anniversaries");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.milestones() }),
  });
}

export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Milestone> & { id: string }) => {
      const { error } = await supabase.from("milestones").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.milestones() }),
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.milestones() }),
  });
}
