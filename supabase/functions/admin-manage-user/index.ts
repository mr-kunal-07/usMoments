import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const body = await req.json();
    const { target_user_id, plan, action } = body;

    if (!target_user_id) return json({ error: "Missing target_user_id" }, 400);

    if (action === "update_plan") {
      if (!plan) return json({ error: "Missing plan" }, 400);

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { data: existingSub } = await adminClient
        .from("subscriptions").select("id, plan")
        .eq("user_id", target_user_id).maybeSingle();

      const oldPlan = existingSub?.plan ?? null;

      let upsertErr;
      if (existingSub) {
        const { error } = await adminClient.from("subscriptions").update({
          plan,
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: plan === "single" ? null : periodEnd.toISOString(),
          updated_at: now.toISOString(),
        }).eq("user_id", target_user_id);
        upsertErr = error;
      } else {
        const { error } = await adminClient.from("subscriptions").insert({
          user_id: target_user_id,
          plan,
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: plan === "single" ? null : periodEnd.toISOString(),
        });
        upsertErr = error;
      }

      if (upsertErr) throw new Error(upsertErr.message);

      await adminClient.from("plan_audit_log").insert({
        target_user_id,
        changed_by_user_id: user.id,
        old_plan: oldPlan,
        new_plan: plan,
      });

      return json({ success: true });
    }

    if (action === "update_password") {
      const { password } = body;
      if (!password) return json({ error: "Missing password" }, 400);
      const { error: pwErr } = await adminClient.auth.admin.updateUserById(target_user_id, { password });
      if (pwErr) throw new Error(pwErr.message);
      return json({ success: true });
    }

    if (action === "delete_user") {
      const { error: delErr } = await adminClient.auth.admin.deleteUser(target_user_id);
      if (delErr) throw new Error(delErr.message);
      return json({ success: true });
    }

    if (action === "toggle_admin") {
      const { add } = body;
      if (add) {
        const { data: existingRole } = await adminClient
          .from("user_roles").select("id")
          .eq("user_id", target_user_id).eq("role", "admin").maybeSingle();
        if (!existingRole) {
          await adminClient.from("user_roles").insert({ user_id: target_user_id, role: "admin" });
        }
      } else {
        await adminClient.from("user_roles").delete()
          .eq("user_id", target_user_id).eq("role", "admin");
      }
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);

  } catch (err) {
    console.error("admin-manage-user error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown" }, 500);
  }
});