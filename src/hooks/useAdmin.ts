import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanAuditEntry {
  id: string;
  target_user_id: string;
  changed_by_user_id: string;
  old_plan: string | null;
  new_plan: string;
  changed_at: string;
  note: string | null;
  target_user: { display_name: string | null; avatar_url: string | null; email: string } | null;
  changed_by_user: { display_name: string | null; avatar_url: string | null; email: string } | null;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  plan: string;
  is_shared_plan?: boolean;
  is_admin?: boolean;
  subscription_status: string | null;
  period_end: string | null;
  storage_used: number;
  upload_count: number;
  created_at: string;
  last_sign_in: string | null;
  has_partner: boolean;
}

// ─── API helper ───────────────────────────────────────────────────────────────

// Derive the functions base URL from the already-required SUPABASE_URL
// so we never depend on a separate VITE_SUPABASE_PROJECT_ID env var.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.access_token;
}

async function callAdminFn(fnName: string, body: object, token: string) {
  const res = await fetch(`${FUNCTIONS_BASE}/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });
}

export function useAdminUsers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin-users"],
    enabled: !!user,
    queryFn: async () => {
      const token = await getToken();
      const result = await callAdminFn("admin-list-users", {}, token);
      return result.users as AdminUser[];
    },
    staleTime: 30_000,
  });
}

export function useAdminManageUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      target_user_id: string;
      action: "update_plan" | "delete_user" | "toggle_admin";
      plan?: string;
      add?: boolean;
    }) => {
      const token = await getToken();
      return callAdminFn("admin-manage-user", params, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-log"] });
    },
  });
}

export function useAdminAuditLog() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin-audit-log"],
    enabled: !!user,
    queryFn: async () => {
      const token = await getToken();
      const result = await callAdminFn("admin-audit-log", {}, token);
      return result.logs as PlanAuditEntry[];
    },
    staleTime: 30_000,
  });
}