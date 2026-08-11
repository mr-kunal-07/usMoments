import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../../src/integrations/supabase/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type AuditLogRow = Database["public"]["Tables"]["plan_audit_log"]["Row"];
type AuditProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "user_id" | "display_name" | "avatar_url">;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    // Verify identity with anon key + user token
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // Privileged queries with service role
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: roleRow } = await adminClient
      .from("user_roles").select("id")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden: admin only" }, 403);

    const { data: logs, error: logsErr } = await adminClient
      .from("plan_audit_log")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(200);

    if (logsErr) throw new Error(logsErr.message);
    if (!logs || logs.length === 0) return json({ logs: [] });

    const typedLogs = (logs ?? []) as AuditLogRow[];
    const userIds = [...new Set([
      ...typedLogs.map((l) => l.target_user_id),
      ...typedLogs.map((l) => l.changed_by_user_id),
    ])];

    const { data: profiles } = await adminClient
      .from("profiles").select("user_id, display_name, avatar_url")
      .in("user_id", userIds);

    const authUsers: Record<string, string> = {};
    for (const uid of userIds) {
      const { data: { user: u } } = await adminClient.auth.admin.getUserById(uid);
      if (u) authUsers[uid] = u.email ?? "";
    }

    const typedProfiles = (profiles ?? []) as AuditProfileRow[];
    const profileMap: Record<string, { display_name: string | null; avatar_url: string | null; email: string }> = {};
    for (const uid of userIds) {
      const p = typedProfiles.find((pr) => pr.user_id === uid);
      profileMap[uid] = {
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        email: authUsers[uid] ?? "",
      };
    }

    const enriched = typedLogs.map((l) => ({
      ...l,
      target_user: profileMap[l.target_user_id] ?? null,
      changed_by_user: profileMap[l.changed_by_user_id] ?? null,
    }));

    return json({ logs: enriched });

  } catch (err) {
    console.error("admin-audit-log error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown" }, 500);
  }
});
