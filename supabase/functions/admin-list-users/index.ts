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

type UserRoleRow = Pick<Database["public"]["Tables"]["user_roles"]["Row"], "user_id">;

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

    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

    const [profilesRes, subsRes, mediaRes, couplesRes, rolesRes] = await Promise.all([
      adminClient.from("profiles").select("*"),
      adminClient.from("subscriptions").select("*").eq("status", "active"),
      adminClient.from("media").select("uploaded_by, file_size"),
      adminClient.from("couples").select("*").eq("status", "active"),
      adminClient.from("user_roles").select("user_id").eq("role", "admin"),
    ]);

    const profiles = profilesRes.data ?? [];
    const subscriptions = subsRes.data ?? [];
    const mediaItems = mediaRes.data ?? [];
    const couples = couplesRes.data ?? [];
    const adminUserIds = new Set(((rolesRes.data ?? []) as UserRoleRow[]).map((r) => r.user_id));

    const partnerMap: Record<string, string> = {};
    for (const c of couples) {
      if (c.user1_id && c.user2_id) {
        partnerMap[c.user1_id] = c.user2_id;
        partnerMap[c.user2_id] = c.user1_id;
      }
    }

    const paidPlanMap: Record<string, string> = {};
    for (const s of subscriptions) {
      if (s.plan && s.plan !== "free" && s.plan !== "single") {
        paidPlanMap[s.user_id] = s.plan;
      }
    }

    const PLAN_RANK: Record<string, number> = { soulmate: 3, dating: 2, single: 1, free: 0 };

    function getEffectivePlan(userId: string): string {
      const ownPlan = paidPlanMap[userId] ?? "single";
      const partnerId = partnerMap[userId];
      const partnerPlan = partnerId && paidPlanMap[partnerId] ? paidPlanMap[partnerId] : "single";
      return (PLAN_RANK[ownPlan] ?? 0) >= (PLAN_RANK[partnerPlan] ?? 0) ? ownPlan : partnerPlan;
    }

    const storageMap: Record<string, number> = {};
    const uploadCountMap: Record<string, number> = {};
    for (const m of mediaItems) {
      storageMap[m.uploaded_by] = (storageMap[m.uploaded_by] ?? 0) + m.file_size;
      uploadCountMap[m.uploaded_by] = (uploadCountMap[m.uploaded_by] ?? 0) + 1;
    }

    const userList = authUsers.map((u) => {
      const profile = profiles.find((p) => p.user_id === u.id);
      const sub = subscriptions.find((s) => s.user_id === u.id);
      const isInCouple = couples.some((c) => c.user1_id === u.id || c.user2_id === u.id);
      const effectivePlan = getEffectivePlan(u.id);
      const isShared = !paidPlanMap[u.id] && effectivePlan !== "single";
      return {
        id: u.id,
        email: u.email,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        plan: effectivePlan,
        is_shared_plan: isShared,
        is_admin: adminUserIds.has(u.id),
        subscription_status: sub?.status ?? null,
        period_end: sub?.current_period_end ?? null,
        storage_used: storageMap[u.id] ?? 0,
        upload_count: uploadCountMap[u.id] ?? 0,
        created_at: u.created_at,
        last_sign_in: u.last_sign_in_at,
        has_partner: isInCouple,
      };
    });

    return json({ users: userList });

  } catch (err) {
    console.error("admin-list-users error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown" }, 500);
  }
});
