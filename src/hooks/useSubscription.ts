import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";

export type Plan = "single" | "dating" | "soulmate";

export interface Subscription {
  id: string;
  user_id: string;
  plan: Plan;
  status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

/** The user's own subscription record (may be null if on free). */
export function useSubscription() {
  const { user } = useAuth();
  return useQuery({
    queryKey: QK.subscription(user?.id),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Subscription | null;
    },
  });
}

/** Effective plan via DB function — returns own plan or partner's if higher. */
function useEffectivePlan() {
  const { user } = useAuth();
  return useQuery({
    queryKey: QK.effectivePlan(user?.id),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_plan", { _user_id: user!.id });
      if (error) throw error;
      return data as string;
    },
  });
}

export function usePlan(): Plan {
  const { data: raw } = useEffectivePlan();
  const plan: string = raw ?? "free";
  if (plan === "free") return "single";
  if (plan === "pro") return "soulmate";
  return plan as Plan;
}

/** True when the user's effective plan comes from their partner (not their own purchase). */
export function useIsSharedPlan(): boolean {
  const { data: subscription } = useSubscription();
  const { data: effectivePlan } = useEffectivePlan();
  const hasPaidOwn = subscription?.plan && (subscription.plan as string) !== "free";
  const effectiveIsPaid = effectivePlan && effectivePlan !== "free";
  return !hasPaidOwn && !!effectiveIsPaid;
}

// ── Plan limits ─────────────────────────────────────────────

export const PLAN_STORAGE: Record<Plan, number> = {
  single:   1  * 1024 * 1024 * 1024,  // 1 GB
  dating:   10 * 1024 * 1024 * 1024,  // 10 GB
  soulmate: 50 * 1024 * 1024 * 1024,  // 50 GB
};

export const PLAN_UPLOAD_LIMIT: Record<Plan, number | null> = {
  single:   50,
  dating:   null, // unlimited
  soulmate: null, // unlimited
};

export const PLAN_STORAGE_LABEL: Record<Plan, string> = {
  single:   "1 GB",
  dating:   "10 GB",
  soulmate: "50 GB",
};

export function canUseVoiceMessages(plan: Plan) {
  return plan === "dating" || plan === "soulmate";
}

export function getStorageLimit(plan: Plan) {
  return PLAN_STORAGE[plan];
}

export function formatStorageLimit(plan: Plan) {
  return PLAN_STORAGE_LABEL[plan];
}
